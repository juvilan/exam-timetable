import { useState } from 'react';
import { useExamStore, useActiveSession } from '../../store/examStore';
import type { SlotConfig } from '../../types';
import styles from './ExamForm.module.css';

// 날짜 문자열("2025-04-27") → "4/27(월)" 형태로 포맷
function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
}

export function ExamForm() {
  const session = useActiveSession();
  const {
    openList, openEditor, updateSession,
    addGrade, removeGrade, updateGradeConfig,
    setDateRange, setPeriodTimeAll, setGradePeriodCount,
  } = useExamStore();

  if (!session) return <NewSessionForm />;

  const gradeNumbers = [1, 2, 3] as const;

  // 교시 시간: 첫 번째 학년의 슬롯을 기준으로 표시 (전 학년 공통)
  const refSlots: SlotConfig[] = session.grades[0]?.slotConfigs[0] ?? [];

  // 학년별 교시 수 (모든 날이 동일하다고 가정)
  function getPeriodCount(grade: 1 | 2 | 3): number {
    const gc = session?.grades.find(g => g.grade === grade);
    return gc?.slotConfigs[0]?.length ?? 0;
  }

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={openList}>← 목록</button>
        <h2 className={styles.pageTitle}>고사 설정</h2>
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => openEditor(session.id)}>
          시간표 편집 →
        </button>
      </div>

      {/* 기본 정보 */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>기본 정보</h3>
        <div className={styles.formGrid}>
          <label className={styles.label}>
            고사명
            <input className={styles.input} value={session.title}
              onChange={e => updateSession(session.id, { title: e.target.value })} />
          </label>
          <label className={styles.label}>
            학년도
            <input className={styles.input} type="number" value={session.schoolYear}
              onChange={e => updateSession(session.id, { schoolYear: Number(e.target.value) })} />
          </label>
          <label className={styles.label}>
            학기
            <select className={styles.select} value={session.semester}
              onChange={e => updateSession(session.id, { semester: Number(e.target.value) as 1 | 2 })}>
              <option value={1}>1학기</option>
              <option value={2}>2학기</option>
            </select>
          </label>
          <label className={styles.label}>
            구분
            <select className={styles.select} value={session.examType}
              onChange={e => updateSession(session.id, { examType: e.target.value as 'mid' | 'final' })}>
              <option value="mid">중간고사</option>
              <option value="final">기말고사</option>
            </select>
          </label>
        </div>
      </section>

      {/* 참여 학년 */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>참여 학년</h3>
        <div className={styles.gradeChips}>
          {gradeNumbers.map(g => {
            const active = session.grades.some(gc => gc.grade === g);
            return (
              <button key={g}
                className={`${styles.gradeChip} ${active ? styles.gradeChipActive : ''}`}
                data-grade={g}
                onClick={() => active ? removeGrade(session.id, g) : addGrade(session.id, g)}>
                {g}학년
              </button>
            );
          })}
        </div>
      </section>

      {/* 시험 기간 */}
      <DateRangeSection session={session} setDateRange={setDateRange} />

      {/* 교시 시간 설정 (전 학년 공통) */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>교시 시간 설정 <span className={styles.hint}>(전 학년 공통, 최대 4교시)</span></h3>
        <div className={styles.slotTable}>
          <div className={styles.slotHeader}>
            <span>교시</span><span>시작</span><span>종료</span><span>시험시간(분)</span>
          </div>
          {refSlots.map((slot, si) => (
            <div key={si} className={styles.slotRow}>
              <span>{slot.period}교시</span>
              <input className={styles.timeInput} type="time" value={slot.startTime}
                onChange={e => setPeriodTimeAll(session.id, si, { startTime: e.target.value })} />
              <input className={styles.timeInput} type="time" value={slot.endTime}
                onChange={e => setPeriodTimeAll(session.id, si, { endTime: e.target.value })} />
              <input className={styles.numInput} type="number" value={slot.durationMin}
                min={10} max={120}
                onChange={e => setPeriodTimeAll(session.id, si, { durationMin: Number(e.target.value) })} />
            </div>
          ))}
        </div>
        <p className={styles.hint2}>※ 시험 종료시간은 과목별 시험시간 설정 후 자동 반영됩니다.</p>
      </section>

      {/* 학년별 교시 수 + 시차등교 */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>학년별 교시 수</h3>
        <div className={styles.gradeSlotRows}>
          {session.grades.map((gc) => {
            const cnt = getPeriodCount(gc.grade);
            return (
              <div key={gc.grade} className={styles.gradeSlotRow}>
                <span className={styles.gradeLabel} data-grade={gc.grade}>{gc.grade}학년</span>
                <div className={styles.periodCounter}>
                  <button className={styles.counterBtn}
                    disabled={cnt <= 1}
                    onClick={() => setGradePeriodCount(session.id, gc.grade, cnt - 1)}>−</button>
                  <span className={styles.counterVal}>{cnt}교시</span>
                  <button className={styles.counterBtn}
                    disabled={cnt >= 4}
                    onClick={() => setGradePeriodCount(session.id, gc.grade, cnt + 1)}>+</button>
                </div>
                <label className={styles.arrivalLabel}>
                  시차등교
                  <input className={styles.timeInput} type="time"
                    value={gc.arrivalTime ?? ''}
                    placeholder="없음"
                    onChange={e => {
                      const gi = session.grades.findIndex(g => g.grade === gc.grade);
                      updateGradeConfig(session.id, gi, { arrivalTime: e.target.value || null });
                    }} />
                </label>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ── 시험 기간 섹션 ─────────────────────────────────────────────
function DateRangeSection({
  session,
  setDateRange,
}: {
  session: ReturnType<typeof useActiveSession>;
  setDateRange: (sessionId: string, startDate: string, endDate: string) => void;
}) {
  if (!session) return null;

  // 현재 날짜에서 시작/종료 추론
  const firstDate = session.days[0]?.date ?? '';
  const lastDate  = session.days[session.days.length - 1]?.date ?? '';

  const [start, setStart] = useState(firstDate);
  const [end,   setEnd]   = useState(lastDate);

  function apply() {
    if (start && end && start <= end && session) setDateRange(session.id, start, end);
  }

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>시험 기간 <span className={styles.hint}>(평일만 자동 선택)</span></h3>
      <div className={styles.dateRangeRow}>
        <label className={styles.label}>
          시작일
          <input className={styles.input} type="date" value={start}
            onChange={e => setStart(e.target.value)} />
        </label>
        <span className={styles.rangeSep}>~</span>
        <label className={styles.label}>
          종료일
          <input className={styles.input} type="date" value={end}
            onChange={e => setEnd(e.target.value)} />
        </label>
        <button className={`${styles.btn} ${styles.btnPrimary}`}
          style={{ marginTop: 18 }}
          onClick={apply}
          disabled={!start || !end || start > end}>
          적용
        </button>
      </div>

      {/* 현재 설정된 날짜 칩 */}
      {session.days.length > 0 && (
        <div className={styles.dayChips}>
          {session.days.map((day, di) => (
            <span key={day.id} className={styles.dayChip}>
              {di + 1}일차 {day.date ? formatDate(day.date) : '미설정'}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

// ── 새 고사 생성 폼 ────────────────────────────────────────────
function NewSessionForm() {
  const { createSession, openSession } = useExamStore();
  const [form, setForm] = useState({
    schoolYear: new Date().getFullYear(),
    semester: 1,
    examType: 'mid' as 'mid' | 'final',
  });

  function handleCreate() {
    const id = createSession({
      schoolYear: form.schoolYear,
      semester:   form.semester as 1 | 2,
      examType:   form.examType,
    });
    openSession(id);
  }

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => useExamStore.getState().openList()}>← 목록</button>
        <h2 className={styles.pageTitle}>새 고사 만들기</h2>
      </div>
      <section className={styles.section}>
        <div className={styles.formGrid}>
          <label className={styles.label}>
            학년도
            <input className={styles.input} type="number" value={form.schoolYear}
              onChange={e => setForm(f => ({ ...f, schoolYear: Number(e.target.value) }))} />
          </label>
          <label className={styles.label}>
            학기
            <select className={styles.select} value={form.semester}
              onChange={e => setForm(f => ({ ...f, semester: Number(e.target.value) }))}>
              <option value={1}>1학기</option>
              <option value={2}>2학기</option>
            </select>
          </label>
          <label className={styles.label}>
            구분
            <select className={styles.select} value={form.examType}
              onChange={e => setForm(f => ({ ...f, examType: e.target.value as 'mid' | 'final' }))}>
              <option value="mid">중간고사</option>
              <option value="final">기말고사</option>
            </select>
          </label>
        </div>
        <button className={`${styles.btn} ${styles.btnPrimary}`} style={{ marginTop: 16 }} onClick={handleCreate}>
          고사 만들기
        </button>
      </section>
    </div>
  );
}
