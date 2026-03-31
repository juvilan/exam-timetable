import type { ExamSession, SeatingResult } from '../../types';
import { GRADE_COLORS } from '../../types';
import styles from './AttendanceView.module.css';

interface Props {
  session: ExamSession;
}

/** 그리드에서 해당 학년의 배치 정보 수집: [{dayIdx, slotIdx, subjectName}] */
function getGradeSchedule(session: ExamSession, gradeIndex: number) {
  const schedule: { dayIdx: number; slotIdx: number; label: string }[] = [];
  for (let di = 0; di < session.days.length; di++) {
    const gradeConfig = session.grades[gradeIndex];
    const slots = gradeConfig.slotConfigs[di] ?? [];
    for (let si = 0; si < slots.length; si++) {
      const cell = session.grid.find(c => c.gradeIndex === gradeIndex && c.dayIndex === di && c.slotIndex === si);
      if (!cell || !cell.content) continue;
      const content = cell.content;
      let label = '';
      if (content.type === 'single') {
        label = session.subjects.find(s => s.id === content.subjectId)?.name ?? '';
      } else {
        label = (content as { type: 'group'; activeSubjectIds: string[] }).activeSubjectIds
          .map(id => session.subjects.find(s => s.id === id)?.name ?? id)
          .join('/');
      }
      schedule.push({ dayIdx: di, slotIdx: si, label });
    }
  }
  return schedule;
}

export function AttendanceView({ session }: Props) {
  const seatingResults = session.seatingResults ?? {};

  return (
    <div>
      {session.grades.map((gradeConfig, gi) => {
        const result: SeatingResult | undefined = seatingResults[String(gradeConfig.grade)];
        if (!result) return null;

        const color    = GRADE_COLORS[gradeConfig.grade];
        const schedule = getGradeSchedule(session, gi);

        return (
          <div key={gi} className={styles.gradeSection}>
            <div className={styles.gradeHeader} style={{ background: color.bg, color: color.text }}>
              <strong>{gradeConfig.grade}학년 응시현황표</strong>
              <span className={styles.meta}>
                총 {result.rooms.reduce((s, r) => s + r.seats.length, 0)}명 · {result.rooms.length}반
              </span>
            </div>

            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>응시반/번호</th>
                  <th className={styles.th}>반</th>
                  <th className={styles.th}>번호</th>
                  <th className={styles.th}>이름</th>
                  {schedule.map((s, i) => (
                    <th key={i} className={styles.thSubj}>
                      {session.days[s.dayIdx]?.date || `${s.dayIdx + 1}일차`}<br />
                      {s.slotIdx + 1}교시<br />
                      <span className={styles.subjName}>{s.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rooms.flatMap(room =>
                  room.seats.map(seat => (
                    <tr key={`${room.roomNumber}-${seat.seatNumber}`}>
                      <td className={styles.td}>{room.roomNumber}반/{String(seat.seatNumber).padStart(2, '0')}번</td>
                      <td className={styles.td}>{seat.homeroom}</td>
                      <td className={styles.td}>{seat.number}</td>
                      <td className={styles.tdName}>{seat.name}</td>
                      {schedule.map((s, i) => {
                        // 이 학생이 이 교시 과목을 응시하는지 확인
                        const subjNames = s.label.split('/');
                        const takes = subjNames.some(subName => {
                          const subjIdx = result.subjectNames.findIndex(n => n === subName || n.includes(subName) || subName.includes(n));
                          return subjIdx >= 0 && seat.subjectFlags[subjIdx] === 1;
                        });
                        return (
                          <td key={i} className={`${styles.td} ${takes ? styles.tdTakes : ''}`}>
                            {takes ? '●' : ''}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
