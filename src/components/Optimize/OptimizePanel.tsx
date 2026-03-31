import { useState, useRef } from 'react';
import { useExamStore } from '../../store/examStore';
import type { ExamSession, GradeMatrix } from '../../types';
import { parseSubjectMatrix } from '../../utils/xlsxImport';
import { calcDaySizes } from '../../utils/gaEngine';
import { assignSeating } from '../../utils/seatingEngine';
import type { GaResult, GaWorkerMessage, GaConfig } from '../../utils/gaEngine';
import styles from './OptimizePanel.module.css';

interface Props {
  session: ExamSession;
}

type RunState = 'idle' | 'running' | 'done' | 'error';

interface GradeOptState {
  matrix:  GradeMatrix | null;
  result:  GaResult | null;
  progress: number;   // 0~100
  curScore: number;
}

export function OptimizePanel({ session }: Props) {
  const { setGradeMatrix, setSeatingResult, applyGaOrder, addSubject } = useExamStore();

  const [runState, setRunState]       = useState<RunState>('idle');
  const [errorMsg, setErrorMsg]       = useState('');
  const [generations, setGenerations] = useState(500);
  const [appliedGrades, setAppliedGrades] = useState<Set<number>>(new Set());
  const workerRef = useRef<Worker | null>(null);

  const optimizableGrades = [2, 3] as const;

  // 학년별 상태
  const [gradeStates, setGradeStates] = useState<Record<string, GradeOptState>>({
    '2': { matrix: session.gradeMatrices?.['2'] ?? null, result: null, progress: 0, curScore: 0 },
    '3': { matrix: session.gradeMatrices?.['3'] ?? null, result: null, progress: 0, curScore: 0 },
  });

  function updateGradeState(grade: string, patch: Partial<GradeOptState>) {
    setGradeStates(prev => ({ ...prev, [grade]: { ...prev[grade], ...patch } }));
  }

  // Excel 가져오기 (학년별)
  function handleImportExcel(grade: 2 | 3) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const buf = ev.target!.result as ArrayBuffer;
          const gradeMatrix = parseSubjectMatrix(buf);
          if (gradeMatrix.grade !== grade) {
            if (!confirm(`파일에서 ${gradeMatrix.grade}학년 데이터가 감지됐습니다. ${grade}학년 데이터로 사용하겠습니까?`)) return;
            gradeMatrix.grade = grade;
          }
          setGradeMatrix(session.id, gradeMatrix);
          updateGradeState(String(grade), { matrix: gradeMatrix });

          // 과목도 자동 추가
          const existing = session.subjects.filter(s => s.grade === grade).map(s => s.name);
          const toAdd = gradeMatrix.subjectNames.filter(n => !existing.includes(n));
          if (toAdd.length > 0) {
            if (confirm(`${grade}학년 과목 ${toAdd.length}개를 추가하겠습니까?\n\n${toAdd.join(', ')}`)) {
              toAdd.forEach(name => addSubject(session.id, { name, grade, examScope: 'both', groupId: null }));
            }
          }
        } catch (err) {
          alert(`가져오기 실패: ${(err as Error).message}`);
        }
      };
      reader.readAsArrayBuffer(file);
    };
    input.click();
  }

  // GA 최적화 실행 (2학년, 3학년 순차 실행)
  async function handleRunOptimize() {
    const gradesToRun = optimizableGrades.filter(g => gradeStates[String(g)]?.matrix);
    if (gradesToRun.length === 0) {
      alert('선택과목 Excel을 먼저 가져오세요 (2학년 또는 3학년).');
      return;
    }

    setRunState('running');
    setErrorMsg('');

    for (const grade of gradesToRun) {
      const { matrix } = gradeStates[String(grade)];
      if (!matrix) continue;

      const daySizes = calcDaySizes(matrix.subjectNames.length, session.days.length);
      const config: GaConfig = { generations };

      await new Promise<void>((resolve, reject) => {
        if (workerRef.current) workerRef.current.terminate();
        const worker = new Worker(
          new URL('../../workers/gaWorker.ts', import.meta.url),
          { type: 'module' }
        );
        workerRef.current = worker;

        worker.onmessage = (e: MessageEvent<GaWorkerMessage>) => {
          const msg = e.data;
          if (msg.type === 'progress') {
            const pct = Math.round((msg.gen / msg.total) * 100);
            updateGradeState(String(grade), { progress: pct, curScore: msg.score });
          } else if (msg.type === 'complete') {
            updateGradeState(String(grade), { result: msg.result, progress: 100, curScore: msg.result.scores.score });
            worker.terminate();
            resolve();
          }
        };
        worker.onerror = (e) => {
          reject(new Error(e.message));
        };
        worker.postMessage({ matrix: matrix.matrix, subjects: matrix.subjectNames, daySizes, config });
      }).catch(err => {
        setErrorMsg(String(err));
        setRunState('error');
      });
    }

    setRunState('done');
  }

  // GA 결과를 그리드에 적용
  function handleApplyResult(grade: 2 | 3) {
    const { matrix, result } = gradeStates[String(grade)];
    if (!matrix || !result) return;

    // order[슬롯인덱스] = 과목인덱스 → periodCodeMap 생성
    const daySizes = calcDaySizes(matrix.subjectNames.length, session.days.length);
    const periodCodeMap: Record<string, string> = {};
    let slotIdx = 0;
    for (let d = 0; d < daySizes.length; d++) {
      for (let p = 0; p < daySizes[d]; p++) {
        if (slotIdx >= result.order.length) break;
        const subjIdx = result.order[slotIdx];
        const subjName = matrix.subjectNames[subjIdx];
        const code = String((d + 1) * 10 + (p + 1));
        periodCodeMap[subjName] = code;
        slotIdx++;
      }
    }

    applyGaOrder(session.id, { order: matrix.subjectNames, periodCodeMap });
    setAppliedGrades(prev => new Set(prev).add(grade));
  }

  function handleStop() {
    workerRef.current?.terminate();
    workerRef.current = null;
    setRunState('idle');
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.title}>최적화 (GA)</h3>
        <p className={styles.desc}>
          2·3학년 선택과목 Excel을 가져온 뒤 GA를 실행하면<br/>
          AI가 최적 시간표를 제안합니다. 이후 드래그앤드롭으로 조정하세요.
        </p>
      </div>

      {/* 학년별 데이터 */}
      <div className={styles.gradeRows}>
        {optimizableGrades.map(grade => {
          const gs = gradeStates[String(grade)];
          return (
            <div key={grade} className={styles.gradeRow}>
              <div className={styles.gradeLabel} data-grade={grade}>{grade}학년</div>
              <div className={styles.gradeInfo}>
                {gs.matrix
                  ? <span className={styles.matrixReady}>✓ {gs.matrix.subjectNames.length}과목 · {gs.matrix.studentCount}명</span>
                  : <span className={styles.matrixMissing}>데이터 없음</span>
                }
              </div>
              <button className={styles.importBtn} onClick={() => handleImportExcel(grade)}>
                📥 Excel
              </button>
              {gs.matrix?.students && (
                <button className={styles.applyBtn} onClick={() => {
                  const result = assignSeating(gs.matrix!);
                  setSeatingResult(session.id, result);
                  alert(`${grade}학년 응시반 편성 완료! ${result.rooms.length}반 배정`);
                }}>
                  🪑 응시반 편성
                </button>
              )}
              {gs.result && (
                <button className={styles.applyBtn} onClick={() => handleApplyResult(grade)}>
                  배치 적용
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 진행률 */}
      {runState === 'running' && (
        <div className={styles.progressArea}>
          {optimizableGrades.map(grade => {
            const gs = gradeStates[String(grade)];
            if (!gs.matrix) return null;
            return (
              <div key={grade} className={styles.progressRow}>
                <span>{grade}학년</span>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${gs.progress}%` }} />
                </div>
                <span className={styles.progressPct}>{gs.progress}%</span>
                <span className={styles.score}>점수 {gs.curScore.toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* 결과 요약 */}
      {runState === 'done' && (
        <div className={styles.resultArea}>
          {optimizableGrades.map(grade => {
            const { result, matrix } = gradeStates[String(grade)];
            if (!result || !matrix) return null;
            const daySizes = calcDaySizes(matrix.subjectNames.length, session.days.length);
            return (
              <div key={grade} className={styles.resultBlock}>
                <div className={styles.resultHeader}>
                  <span>{grade}학년 최적화 완료</span>
                  <span className={styles.resultScore}>최종 점수: {result.scores.score.toLocaleString()}</span>
                </div>
                <div className={styles.timetablePreview}>
                  {daySizes.map((size, di) => (
                    <div key={di} className={styles.dayCol}>
                      <div className={styles.dayColHeader}>{di + 1}일차</div>
                      {Array.from({ length: size }).map((_, si) => {
                        const slotFlat = daySizes.slice(0, di).reduce((a, b) => a + b, 0) + si;
                        const subjIdx = result.order[slotFlat];
                        return (
                          <div key={si} className={styles.dayColCell}>
                            <span className={styles.periodNum}>{si + 1}교시</span>
                            <span className={styles.subjectName}>{matrix.subjectNames[subjIdx] ?? '-'}</span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <button className={styles.applyBtnLarge} onClick={() => handleApplyResult(grade)}>
                  {appliedGrades.has(grade) ? '✓ 적용됨 (다시 적용)' : '이 시간표를 그리드에 적용'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 적용 후 다음 단계 안내 */}
      {appliedGrades.size > 0 && (
        <div className={styles.nextStep}>
          <strong>다음 단계</strong>
          <ol className={styles.nextStepList}>
            <li>왼쪽 그리드에 과목이 자동 배치됩니다</li>
            <li>위치 변경 → 카드를 드래그해서 다른 칸으로 이동</li>
            <li>1학년 과목 → <b>📚 과목·그룹</b> 탭에서 추가 후 그리드에 드래그</li>
            <li>완료 후 → 상단 <b>🖨 인쇄 미리보기</b></li>
          </ol>
        </div>
      )}

      {/* 오류 */}
      {errorMsg && <div className={styles.error}>{errorMsg}</div>}

      {/* 설정 + 실행 버튼 */}
      <div className={styles.controls}>
        <label className={styles.genLabel}>
          세대수
          <input
            type="number"
            className={styles.genInput}
            value={generations}
            min={100}
            max={2000}
            step={100}
            onChange={e => setGenerations(Number(e.target.value))}
            disabled={runState === 'running'}
          />
        </label>
        {runState === 'running'
          ? <button className={styles.stopBtn} onClick={handleStop}>■ 중단</button>
          : <button
              className={styles.runBtn}
              onClick={handleRunOptimize}
              disabled={false}
            >
              ▶ 최적화 실행
            </button>
        }
      </div>
    </div>
  );
}
