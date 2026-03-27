import { useState } from 'react';
import { useExamStore, useActiveSession } from '../../store/examStore';
import type { SlotConfig } from '../../types';
import styles from './ExamForm.module.css';

export function ExamForm() {
  const session = useActiveSession();
  const { openList, openEditor, updateSession, addDay, removeDay, updateDay,
    addGrade, removeGrade, updateGradeConfig, updateSlot, addSlot, removeSlot } = useExamStore();

  // 새 고사 생성 모드
  if (!session) {
    return <NewSessionForm />;
  }

  const gradeNumbers = [1, 2, 3] as const;

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={openList}>← 목록</button>
        <h2 className={styles.pageTitle}>고사 설정</h2>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={() => openEditor(session.id)}
        >
          시간표 편집 →
        </button>
      </div>

      {/* 기본 정보 */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>기본 정보</h3>
        <div className={styles.formGrid}>
          <label className={styles.label}>
            고사명
            <input
              className={styles.input}
              value={session.title}
              onChange={e => updateSession(session.id, { title: e.target.value })}
            />
          </label>
          <label className={styles.label}>
            학년도
            <input
              className={styles.input}
              type="number"
              value={session.schoolYear}
              onChange={e => updateSession(session.id, { schoolYear: Number(e.target.value) })}
            />
          </label>
          <label className={styles.label}>
            학기
            <select
              className={styles.select}
              value={session.semester}
              onChange={e => updateSession(session.id, { semester: Number(e.target.value) as 1|2 })}
            >
              <option value={1}>1학기</option>
              <option value={2}>2학기</option>
            </select>
          </label>
          <label className={styles.label}>
            구분
            <select
              className={styles.select}
              value={session.examType}
              onChange={e => updateSession(session.id, { examType: e.target.value as 'mid'|'final' })}
            >
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
              <button
                key={g}
                className={`${styles.gradeChip} ${active ? styles.gradeChipActive : ''}`}
                data-grade={g}
                onClick={() => active ? removeGrade(session.id, g) : addGrade(session.id, g)}
              >
                {g}학년
              </button>
            );
          })}
        </div>
      </section>

      {/* 시험 일자 */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>시험 일자</h3>
          {session.days.length < 5 && (
            <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => addDay(session.id)}>
              + 일자 추가
            </button>
          )}
        </div>
        <div className={styles.dayList}>
          {session.days.map((day, di) => (
            <div key={day.id} className={styles.dayItem}>
              <span className={styles.dayLabel}>{di + 1}일차</span>
              <input
                className={styles.input}
                type="date"
                value={day.date}
                onChange={e => updateDay(session.id, di, { date: e.target.value })}
              />
              {session.days.length > 1 && (
                <button className={styles.removeBtn} onClick={() => removeDay(session.id, di)}>✕</button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 학년별 교시 설정 */}
      {session.grades.map((gradeConfig, gi) => (
        <section key={gradeConfig.grade} className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle} data-grade={gradeConfig.grade}>
              {gradeConfig.grade}학년 교시 설정
            </h3>
            <label className={styles.inlineLabel}>
              시차등교
              <input
                className={styles.input}
                type="time"
                value={gradeConfig.arrivalTime ?? ''}
                placeholder="없음"
                onChange={e =>
                  updateGradeConfig(session.id, gi, { arrivalTime: e.target.value || null })
                }
              />
            </label>
          </div>
          {session.days.map((day, di) => (
            <div key={day.id} className={styles.daySlots}>
              <div className={styles.daySlotsHeader}>
                {di + 1}일차 {day.date && <span className={styles.dateText}>({day.date})</span>}
                <button
                  className={`${styles.btn} ${styles.btnXs}`}
                  onClick={() => addSlot(session.id, gi, di)}
                >+ 교시</button>
              </div>
              <div className={styles.slotTable}>
                <div className={styles.slotHeader}>
                  <span>교시</span><span>시작</span><span>종료</span><span>시간(분)</span><span></span>
                </div>
                {(gradeConfig.slotConfigs[di] ?? []).map((slot, si) => (
                  <SlotRow
                    key={si}
                    slot={slot}
                    onChange={patch => updateSlot(session.id, gi, di, si, patch)}
                    onRemove={() => removeSlot(session.id, gi, di, si)}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

function SlotRow({
  slot, onChange, onRemove,
}: {
  slot: SlotConfig;
  onChange: (patch: Partial<SlotConfig>) => void;
  onRemove: () => void;
}) {
  return (
    <div className={styles.slotRow}>
      <span>{slot.period}교시</span>
      <input
        className={styles.timeInput}
        type="time"
        value={slot.startTime}
        onChange={e => onChange({ startTime: e.target.value })}
      />
      <input
        className={styles.timeInput}
        type="time"
        value={slot.endTime}
        onChange={e => onChange({ endTime: e.target.value })}
      />
      <input
        className={styles.numInput}
        type="number"
        value={slot.durationMin}
        min={10}
        max={120}
        onChange={e => onChange({ durationMin: Number(e.target.value) })}
      />
      <button className={styles.removeBtn} onClick={onRemove}>✕</button>
    </div>
  );
}

function NewSessionForm() {
  const { createSession, openSession } = useExamStore();
  const [form, setForm] = useState({ schoolYear: new Date().getFullYear(), semester: 1, examType: 'mid' as 'mid'|'final' });

  function handleCreate() {
    const id = createSession({
      schoolYear: form.schoolYear,
      semester:   form.semester as 1|2,
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
            <input
              className={styles.input}
              type="number"
              value={form.schoolYear}
              onChange={e => setForm(f => ({ ...f, schoolYear: Number(e.target.value) }))}
            />
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
              onChange={e => setForm(f => ({ ...f, examType: e.target.value as 'mid'|'final' }))}>
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
