import type { ExamSession, CellContent } from '../../types';
import { GRADE_COLORS } from '../../types';
import styles from './PrintView.module.css';

interface Props {
  session: ExamSession;
}

/** "HH:MM" 문자열을 분 단위 숫자로 변환 (시간 비교용) */
function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function PrintView({ session }: Props) {
  function contentLabel(content: CellContent): string {
    if (content.type === 'single') {
      return session.subjects.find(s => s.id === content.subjectId)?.name ?? '';
    }
    return (content as { type: 'group'; activeSubjectIds: string[] }).activeSubjectIds
      .map(id => session.subjects.find(s => s.id === id)?.name ?? id)
      .join(' / ');
  }

  function getCellLabel(gi: number, di: number, si: number): string {
    const cell = session.grid.find(c => c.gradeIndex === gi && c.dayIndex === di && c.slotIndex === si);
    return cell?.content ? contentLabel(cell.content) : '';
  }

  return (
    <div className={styles.printWrap}>
      <div className={styles.printHeader}>
        <h1 className={styles.printTitle}>{session.title}</h1>
      </div>

      <table className={styles.printTable}>
        <thead>
          <tr>
            <th className={styles.thCorner} rowSpan={2}>학년<br />일시</th>
            {session.grades.map((g, gi) => {
              const color = GRADE_COLORS[g.grade];
              return (
                <th key={gi} colSpan={3} className={styles.thGrade}
                  style={{ background: color.bg, color: color.text }}>
                  {g.grade}학년
                </th>
              );
            })}
          </tr>
          <tr>
            {session.grades.map((_, gi) => (
              <>
                <th key={`${gi}-a`} className={styles.thSub}>교시</th>
                <th key={`${gi}-b`} className={styles.thSub}>시간</th>
                <th key={`${gi}-c`} className={styles.thSub}>과목</th>
              </>
            ))}
          </tr>
        </thead>
        <tbody>
          {session.days.map((day, di) => {
            // 이 일차에 존재하는 모든 고유 시작시간 수집 → 정렬
            const allStartTimes = Array.from(
              new Set(
                session.grades.flatMap((g) =>
                  (g.slotConfigs[di] ?? []).map(s => s.startTime)
                )
              )
            ).sort();

            if (allStartTimes.length === 0) return null;

            // 행별 렌더링 정보 수집
            // rowInfos[rowIdx][gi] = { slot, si, isArrival, arrivalRowspan }
            type CellInfo =
              | { kind: 'arrival'; rowspan: number }     // 등교 셀 (첫 등교 행만)
              | { kind: 'arrival-skip' }                 // 등교 rowspan에 포함된 행 (렌더 안 함)
              | { kind: 'period'; si: number; startTime: string; endTime: string }
              | { kind: 'empty' };

            const grid: CellInfo[][] = allStartTimes.map((startTime, rowIdx) => {
              return session.grades.map((gradeConfig, _gi) => {
                const slots = gradeConfig.slotConfigs[di] ?? [];
                const arrivalMin = gradeConfig.arrivalTime ? timeToMin(gradeConfig.arrivalTime) : null;
                const startMin   = timeToMin(startTime);

                // 이 학년이 이 시간대에 교시가 있는지 확인
                const si = slots.findIndex(s => s.startTime === startTime);

                if (arrivalMin !== null && startMin < arrivalMin) {
                  // 도착 전 시간대 → 등교 셀
                  // 등교 rowspan 계산: arrivalTime 이전 시작시간 개수
                  const arrivalRows = allStartTimes.filter(t => timeToMin(t) < arrivalMin).length;
                  if (rowIdx === 0) {
                    return { kind: 'arrival', rowspan: arrivalRows } as CellInfo;
                  }
                  return { kind: 'arrival-skip' } as CellInfo;
                }

                if (si >= 0) {
                  return { kind: 'period', si, startTime: slots[si].startTime, endTime: slots[si].endTime } as CellInfo;
                }
                return { kind: 'empty' } as CellInfo;
              });
            });

            const totalRows = allStartTimes.length;

            return grid.map((rowCells, rowIdx) => (
              <tr key={`${di}-${rowIdx}`}>
                {/* 날짜 셀: 첫 행에만 */}
                {rowIdx === 0 && (
                  <td className={styles.tdDate} rowSpan={totalRows}>
                    {day.date
                      ? <><strong>{day.date}</strong></>
                      : <><strong>{di + 1}일차</strong></>
                    }
                  </td>
                )}

                {rowCells.map((cell, gi) => {
                  const color = GRADE_COLORS[session.grades[gi].grade];

                  if (cell.kind === 'arrival') {
                    return (
                      <td key={gi} colSpan={3} rowSpan={cell.rowspan}
                        className={styles.tdArrival}
                        style={{ background: color.bg, color: color.text }}>
                        {session.grades[gi].arrivalTime} 등교
                      </td>
                    );
                  }
                  if (cell.kind === 'arrival-skip') return null;

                  if (cell.kind === 'period') {
                    const label = getCellLabel(gi, di, cell.si);
                    return (
                      <>
                        <td key={`${gi}-p`} className={styles.tdPeriod}
                          style={{ background: color.bg, color: color.text }}>
                          {cell.si + 1}교시
                        </td>
                        <td key={`${gi}-t`} className={styles.tdTime}>
                          {cell.startTime}-{cell.endTime}
                        </td>
                        <td key={`${gi}-s`} className={`${styles.tdSubject} ${label ? styles.tdSubjectFilled : ''}`}>
                          {label}
                        </td>
                      </>
                    );
                  }

                  // empty
                  return (
                    <>
                      <td key={`${gi}-p`} className={styles.tdPeriod}></td>
                      <td key={`${gi}-t`} className={styles.tdTime}></td>
                      <td key={`${gi}-s`} className={styles.tdSubject}></td>
                    </>
                  );
                })}
              </tr>
            ));
          })}
        </tbody>
      </table>

      <div className={styles.printActions}>
        <button className={styles.printBtn} onClick={() => window.print()}>🖨 인쇄</button>
      </div>
    </div>
  );
}
