import type { ExamSession, CellContent } from '../../types';
import { GRADE_COLORS } from '../../types';
import styles from './PrintView.module.css';

interface Props {
  session: ExamSession;
}

export function PrintView({ session }: Props) {
  function getCell(gi: number, di: number, si: number) {
    return session.grid.find(c => c.gradeIndex === gi && c.dayIndex === di && c.slotIndex === si);
  }

  function contentLabel(content: CellContent): string {
    if (content.type === 'single') {
      return session.subjects.find(s => s.id === content.subjectId)?.name ?? '-';
    }
    return content.activeSubjectIds
      .map(id => session.subjects.find(s => s.id === id)?.name ?? id)
      .join(' / ');
  }

  const maxSlots = Math.max(
    ...session.grades.flatMap(g => g.slotConfigs.flatMap(day => day.length)),
    0
  );

  return (
    <div className={styles.printWrap}>
      <div className={styles.printHeader}>
        <h1 className={styles.printTitle}>{session.title}</h1>
      </div>

      <table className={styles.printTable}>
        <thead>
          <tr>
            <th className={styles.thCorner}></th>
            {session.days.map((day, di) => (
              <th key={di} className={styles.thDay}>
                {di + 1}일차{day.date ? `\n(${day.date})` : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {session.grades.map((gradeConfig, gi) => {
            const color = GRADE_COLORS[gradeConfig.grade];

            return (
              <>
                {/* 시차등교 행 */}
                {gradeConfig.arrivalTime && (
                  <tr key={`arrival-${gi}`} className={styles.arrivalRow}>
                    <td
                      className={styles.tdRowHeader}
                      style={{ background: color.bg, color: color.text }}
                    >
                      <strong>{gradeConfig.grade}학년</strong>
                    </td>
                    {session.days.map((_, di) => (
                      <td key={di} className={styles.tdArrival} style={{ background: color.bg }}>
                        {gradeConfig.arrivalTime} 등교
                      </td>
                    ))}
                  </tr>
                )}

                {Array.from({ length: maxSlots }).map((_, si) => {
                  const slot = gradeConfig.slotConfigs[0]?.[si];
                  if (!slot) return null;

                  return (
                    <tr key={`${gi}-${si}`}>
                      <td
                        className={styles.tdRowHeader}
                        style={si === 0 && !gradeConfig.arrivalTime
                          ? { background: color.bg, color: color.text }
                          : {}
                        }
                      >
                        {si === 0 && !gradeConfig.arrivalTime && (
                          <strong>{gradeConfig.grade}학년</strong>
                        )}
                        <div className={styles.periodInfo}>
                          {si + 1}교시
                          <span className={styles.timeInfo}>{slot.startTime}~{slot.endTime}</span>
                        </div>
                      </td>
                      {session.days.map((_, di) => {
                        const cell    = getCell(gi, di, si);
                        const label   = cell?.content ? contentLabel(cell.content) : '';
                        const isGroup = cell?.content?.type === 'group';

                        return (
                          <td key={di} className={`${styles.tdCell} ${isGroup ? styles.tdGroup : ''}`}>
                            {label}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </>
            );
          })}
        </tbody>
      </table>

      <div className={styles.printActions}>
        <button className={styles.printBtn} onClick={() => window.print()}>🖨 인쇄</button>
      </div>
    </div>
  );
}
