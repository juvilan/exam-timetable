import { useState } from 'react';
import { useExamStore } from '../../store/examStore';
import type { ExamSession, Subject, SubjectGroup, GaImportData } from '../../types';
import { isSubjectActive } from '../../utils/examDefaults';
import { parseSubjectExcel, parseGaResultExcel, parseTimetableSheet } from '../../utils/xlsxImport';
import styles from './SubjectPanel.module.css';

interface Props {
  session: ExamSession;
}

export function SubjectPanel({ session }: Props) {
  const { addSubject, updateSubject, removeSubject, addGroup, updateGroup, removeGroup, applyGaOrder } =
    useExamStore();
  const [tab, setTab]           = useState<'subjects' | 'groups' | 'ga'>('subjects');
  const [addingGrade, setAddingGrade] = useState<1|2|3|null>(null);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [gaText, setGaText]     = useState('');

  const grades = [1, 2, 3] as const;

  // 미배치 과목 집합
  const placedSubjectIds = new Set(
    session.grid.flatMap(cell => {
      if (!cell.content) return [];
      if (cell.content.type === 'single') return [cell.content.subjectId];
      return cell.content.activeSubjectIds;
    })
  );

  function handleAddSubject(grade: 1|2|3) {
    if (!newSubjectName.trim()) return;
    addSubject(session.id, {
      name:       newSubjectName.trim(),
      grade,
      examScope:  'both',
      groupId:    null,
    });
    setNewSubjectName('');
    setAddingGrade(null);
  }

  function handleSubjectExcelImport() {
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
          const { grade, subjectNames, studentCount } = parseSubjectExcel(buf);
          const existing = session.subjects.filter(s => s.grade === grade).map(s => s.name);
          const toAdd = subjectNames.filter(n => !existing.includes(n));
          if (toAdd.length === 0) {
            alert(`${grade}학년 과목이 이미 모두 등록되어 있습니다.`);
            return;
          }
          if (confirm(`${grade}학년 과목 ${toAdd.length}개를 추가하겠습니까?\n(학생수 ${studentCount}명 감지)\n\n${toAdd.join(', ')}`)) {
            toAdd.forEach(name => addSubject(session.id, { name, grade, examScope: 'both', groupId: null }));
          }
        } catch (err) {
          alert(`가져오기 실패: ${(err as Error).message}`);
        }
      };
      reader.readAsArrayBuffer(file);
    };
    input.click();
  }

  function handleGaExcelImport() {
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
          // 먼저 시험시간표 시트 시도
          const cells = parseTimetableSheet(buf);
          if (cells.length > 0) {
            const data: GaImportData = {
              order: cells.map(c => c.subjectName),
              periodCodeMap: Object.fromEntries(cells.map(c => [c.subjectName, String((c.dayIndex + 1) * 10 + (c.slotIndex + 1))])),
            };
            if (confirm(`시험시간표 시트에서 ${cells.length}개 배치를 발견했습니다.\n적용하겠습니까?`)) {
              applyGaOrder(session.id, data);
            }
            return;
          }
          // 시험_교시코드 시트 시도
          const gaRows = parseGaResultExcel(buf);
          if (gaRows.length === 0) {
            alert('교시코드 데이터를 찾을 수 없습니다.\n시험_교시코드 또는 시험시간표 시트가 있는 파일을 선택하세요.');
            return;
          }
          const data: GaImportData = {
            order: gaRows.map(r => r.subjectName),
            periodCodeMap: Object.fromEntries(gaRows.map(r => [r.subjectName, String(r.periodCode)])),
          };
          if (confirm(`${gaRows.length}개 과목의 교시코드를 적용하겠습니까?\n\n${gaRows.map(r => `${r.subjectName}→${r.periodCode}`).join(', ')}`)) {
            applyGaOrder(session.id, data);
          }
        } catch (err) {
          alert(`가져오기 실패: ${(err as Error).message}`);
        }
      };
      reader.readAsArrayBuffer(file);
    };
    input.click();
  }

  function handleGaImport() {
    try {
      let data: GaImportData;
      const trimmed = gaText.trim();

      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        // JSON 형식
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          data = { order: parsed };
        } else if (parsed.periodCodeMap) {
          data = { periodCodeMap: parsed.periodCodeMap, order: Object.keys(parsed.periodCodeMap) };
        } else {
          data = parsed as GaImportData;
        }
      } else {
        // 텍스트 형식: "과목명,교시코드" 한 줄씩
        const periodCodeMap: Record<string, string> = {};
        for (const line of trimmed.split(/\r?\n/)) {
          const parts = line.split(',');
          if (parts.length >= 2) {
            periodCodeMap[parts[0].trim()] = parts[1].trim();
          }
        }
        data = { order: Object.keys(periodCodeMap), periodCodeMap };
      }

      applyGaOrder(session.id, data);
      alert('GA 결과를 적용했습니다.');
    } catch (err) {
      alert(`가져오기 실패: ${(err as Error).message}`);
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.tabBar}>
        {(['subjects', 'groups', 'ga'] as const).map(t => (
          <button
            key={t}
            className={`${styles.tabBtn} ${tab === t ? styles.tabBtnActive : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'subjects' ? '과목' : t === 'groups' ? '그룹' : 'GA'}
          </button>
        ))}
      </div>

      {/* 과목 탭 */}
      {tab === 'subjects' && (
        <div className={styles.tabContent}>
          <button className={styles.xlsxImportBtn} onClick={handleSubjectExcelImport}>
            📥 선택과목 Excel 가져오기
          </button>
          <p className={styles.xlsxImportDesc}>
            형식: 1행=헤더(학년/반/번호/이름/과목…), 2행~=학생데이터
          </p>
          {grades.map(grade => {
            const gradeSubjects = session.subjects.filter(s => s.grade === grade);
            return (
              <div key={grade} className={styles.gradeSection}>
                <div className={styles.gradeHeader} data-grade={grade}>
                  <span>{grade}학년 <span className={styles.count}>({gradeSubjects.length})</span></span>
                  <button
                    className={styles.addBtn}
                    onClick={() => setAddingGrade(addingGrade === grade ? null : grade)}
                  >+</button>
                </div>

                {addingGrade === grade && (
                  <div className={styles.addRow}>
                    <input
                      className={styles.addInput}
                      value={newSubjectName}
                      onChange={e => setNewSubjectName(e.target.value)}
                      placeholder="과목명"
                      onKeyDown={e => e.key === 'Enter' && handleAddSubject(grade)}
                      autoFocus
                    />
                    <button className={styles.confirmBtn} onClick={() => handleAddSubject(grade)}>추가</button>
                  </div>
                )}

                {gradeSubjects.map(subject => (
                  <SubjectItem
                    key={subject.id}
                    subject={subject}
                    groups={session.groups}
                    isPlaced={placedSubjectIds.has(subject.id)}
                    isActive={isSubjectActive(subject.examScope, session.examType)}
                    onUpdate={patch => updateSubject(session.id, subject.id, patch)}
                    onRemove={() => removeSubject(session.id, subject.id)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* 그룹 탭 */}
      {tab === 'groups' && (
        <div className={styles.tabContent}>
          <button
            className={styles.addGroupBtn}
            onClick={() => {
              addGroup(session.id, {
                displayLabel: '새 그룹',
                subjectIds:   [],
                groupType:    'elective',
              });
            }}
          >
            + 그룹 추가
          </button>
          {session.groups.map(group => (
            <GroupItem
              key={group.id}
              group={group}
              subjects={session.subjects}
              onUpdate={patch => updateGroup(session.id, group.id, patch)}
              onRemove={() => removeGroup(session.id, group.id)}
              onToggleSubject={(subjectId) => {
                const current = group.subjectIds;
                const newIds  = current.includes(subjectId)
                  ? current.filter(id => id !== subjectId)
                  : [...current, subjectId];
                updateGroup(session.id, group.id, { subjectIds: newIds });
                // 과목의 groupId도 업데이트
                const subject = session.subjects.find(s => s.id === subjectId);
                if (subject) {
                  const store = useExamStore.getState();
                  store.updateSubject(session.id, subjectId, {
                    groupId: newIds.includes(subjectId) ? group.id : null,
                  });
                }
              }}
            />
          ))}
        </div>
      )}

      {/* GA 탭 */}
      {tab === 'ga' && (
        <div className={styles.tabContent}>
          <button className={styles.xlsxImportBtn} onClick={handleGaExcelImport}>
            📥 가안 Excel에서 배치 가져오기
          </button>
          <p className={styles.xlsxImportDesc}>
            시험_교시코드 또는 시험시간표 시트가 있는 가안 파일 선택
          </p>
          <div className={styles.gaDivider}>또는 직접 입력</div>
          <p className={styles.gaDesc}>
            <code>과목명,교시코드</code> 형식 (11=1일차1교시, 23=2일차3교시)
          </p>
          <textarea
            className={styles.gaTextarea}
            value={gaText}
            onChange={e => setGaText(e.target.value)}
            placeholder={`예시:\n수학Ⅰ,11\n영어Ⅰ,12\n물리학Ⅰ,21`}
            rows={8}
          />
          <button className={styles.gaImportBtn} onClick={handleGaImport}>
            GA 결과 적용
          </button>
        </div>
      )}
    </div>
  );
}

function SubjectItem({
  subject, groups, isPlaced, isActive, onUpdate, onRemove,
}: {
  subject: Subject;
  groups: SubjectGroup[];
  isPlaced: boolean;
  isActive: boolean;
  onUpdate: (patch: Partial<Subject>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`${styles.subjectItem} ${!isActive ? styles.subjectInactive : ''} ${!isPlaced && isActive ? styles.subjectUnplaced : ''}`}>
      <div className={styles.subjectRow} onClick={() => setExpanded(e => !e)}>
        <span className={styles.subjectName}>{subject.name}</span>
        <div className={styles.subjectBadges}>
          {!isActive && <span className={styles.badge} data-type="inactive">비응시</span>}
          {isActive && !isPlaced && <span className={styles.badge} data-type="unplaced">미배치</span>}
          {subject.groupId && <span className={styles.badge} data-type="group">그룹</span>}
        </div>
        <button className={styles.expandBtn}>{expanded ? '▲' : '▼'}</button>
      </div>

      {expanded && (
        <div className={styles.subjectDetail}>
          <label className={styles.detailLabel}>
            과목명
            <input
              className={styles.detailInput}
              value={subject.name}
              onChange={e => onUpdate({ name: e.target.value })}
            />
          </label>
          <label className={styles.detailLabel}>
            응시 범위
            <select
              className={styles.detailSelect}
              value={subject.examScope}
              onChange={e => onUpdate({ examScope: e.target.value as Subject['examScope'] })}
            >
              <option value="both">중간+기말</option>
              <option value="mid_only">중간고사만</option>
              <option value="final_only">기말고사만</option>
              <option value="none">미응시</option>
            </select>
          </label>
          <label className={styles.detailLabel}>
            그룹
            <select
              className={styles.detailSelect}
              value={subject.groupId ?? ''}
              onChange={e => onUpdate({ groupId: e.target.value || null })}
            >
              <option value="">없음</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.displayLabel}</option>
              ))}
            </select>
          </label>
          <label className={styles.detailLabel}>
            집중이수 반
            <input
              className={styles.detailInput}
              value={subject.concentratedClass ?? ''}
              placeholder="예: 1~4반"
              onChange={e => onUpdate({ concentratedClass: e.target.value || null })}
            />
          </label>
          <label className={styles.detailLabel}>
            시험 시간(분)
            <input
              className={styles.detailInput}
              type="number"
              min={10}
              max={200}
              value={subject.durationMin ?? 50}
              onChange={e => onUpdate({ durationMin: Number(e.target.value) })}
            />
          </label>
          <button className={styles.removeSubjectBtn} onClick={onRemove}>삭제</button>
        </div>
      )}
    </div>
  );
}

function GroupItem({
  group, subjects, onUpdate, onRemove, onToggleSubject,
}: {
  group: SubjectGroup;
  subjects: Subject[];
  onUpdate: (patch: Partial<SubjectGroup>) => void;
  onRemove: () => void;
  onToggleSubject: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const groupTypeLabel: Record<string, string> = {
    elective:    '선택과목',
    class_split: '반 분할',
    culture:     '문화',
  };

  return (
    <div className={styles.groupItem}>
      <div className={styles.groupRow} onClick={() => setExpanded(e => !e)}>
        <span className={`${styles.groupType}`} data-gtype={group.groupType}>
          {groupTypeLabel[group.groupType]}
        </span>
        <span className={styles.groupLabel}>{group.displayLabel}</span>
        <span className={styles.groupCount}>{group.subjectIds.length}과목</span>
        <button className={styles.expandBtn}>{expanded ? '▲' : '▼'}</button>
      </div>
      {expanded && (
        <div className={styles.groupDetail}>
          <label className={styles.detailLabel}>
            표시 이름
            <input className={styles.detailInput} value={group.displayLabel}
              onChange={e => onUpdate({ displayLabel: e.target.value })} />
          </label>
          <label className={styles.detailLabel}>
            유형
            <select className={styles.detailSelect} value={group.groupType}
              onChange={e => onUpdate({ groupType: e.target.value as SubjectGroup['groupType'] })}>
              <option value="elective">선택과목 (elective)</option>
              <option value="class_split">반 분할 (class_split)</option>
              <option value="culture">문화 (culture)</option>
            </select>
          </label>
          <div className={styles.detailLabel}>포함 과목</div>
          <div className={styles.groupSubjects}>
            {subjects.map(s => (
              <label key={s.id} className={styles.groupSubjectCheck}>
                <input
                  type="checkbox"
                  checked={group.subjectIds.includes(s.id)}
                  onChange={() => onToggleSubject(s.id)}
                />
                {s.grade}학년 {s.name}
              </label>
            ))}
          </div>
          <button className={styles.removeSubjectBtn} onClick={onRemove}>그룹 삭제</button>
        </div>
      )}
    </div>
  );
}
