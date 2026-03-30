import type { ExamSession, SeatingResult } from '../../types';
import { GRADE_COLORS } from '../../types';
import styles from './SeatingView.module.css';

interface Props {
  session: ExamSession;
}

export function SeatingView({ session }: Props) {
  const seatingResults = session.seatingResults ?? {};

  return (
    <div>
      {session.grades.map((gradeConfig, gi) => {
        const result: SeatingResult | undefined = seatingResults[String(gradeConfig.grade)];
        if (!result) return null;

        const color = GRADE_COLORS[gradeConfig.grade];

        return (
          <div key={gi}>
            <div className={styles.gradeTitle} style={{ color: color.text }}>
              {gradeConfig.grade}학년 좌석배치도
            </div>

            <div className={styles.roomsGrid}>
              {result.rooms.map(room => (
                <div key={room.roomNumber} className={styles.room}>
                  <div className={styles.roomHeader} style={{ background: color.bg, color: color.text }}>
                    {room.roomNumber}반 ({room.seats.length}명)
                  </div>

                  <table className={styles.seatTable}>
                    <thead>
                      <tr>
                        <th className={styles.sth}>번호</th>
                        <th className={styles.sth}>반</th>
                        <th className={styles.sth}>번</th>
                        <th className={styles.sth}>이름</th>
                      </tr>
                    </thead>
                    <tbody>
                      {room.seats.map(seat => (
                        <tr key={seat.seatNumber}>
                          <td className={styles.std}>{seat.seatNumber}</td>
                          <td className={styles.std}>{seat.homeroom}</td>
                          <td className={styles.std}>{seat.number}</td>
                          <td className={styles.stdName}>{seat.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className={styles.deskLabel}>▲ 교탁</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
