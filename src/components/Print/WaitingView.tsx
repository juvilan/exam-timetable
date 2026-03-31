import React from 'react';
import type { ExamSession, SeatingResult } from '../../types';
import { GRADE_COLORS } from '../../types';
import styles from './WaitingView.module.css';

interface Props {
  session: ExamSession;
}

interface WaitingEntry {
  roomNumber: number;
  seatNumber: number;
  homeroom: number;
  number: number;
  name: string;
  nextPeriodLabel: string; // "4/29(수) 3교시 정치와 법"
}

export function WaitingView({ session }: Props) {
  const seatingResults = session.seatingResults ?? {};

  /** 그리드에서 (gi, di, si)에 배치된 과목명 목록 반환 */
  function getSubjectNames(gi: number, di: number, si: number): string[] {
    const cell = session.grid.find(c => c.gradeIndex === gi && c.dayIndex === di && c.slotIndex === si);
    if (!cell || !cell.content) return [];
    const content = cell.content;
    if (content.type === 'single') {
      const s = session.subjects.find(s => s.id === content.subjectId);
      return s ? [s.name] : [];
    }
    return (content as { type: 'group'; activeSubjectIds: string[] }).activeSubjectIds
      .map(id => session.subjects.find(s => s.id === id)?.name ?? '').filter(Boolean);
  }

  const sections: React.ReactElement[] = [];

  session.grades.forEach((gradeConfig, gi) => {
    const result: SeatingResult | undefined = seatingResults[String(gradeConfig.grade)];
    if (!result) return;

    const color = GRADE_COLORS[gradeConfig.grade];

    // 모든 학생을 응시반/번호로 빠르게 조회할 수 있도록 맵 생성
    // subjectFlags는 result.subjectNames 순서
    const studentMap = new Map<string, { roomNumber: number; seatNumber: number; homeroom: number; number: number; name: string; subjectFlags: number[] }>();
    for (const room of result.rooms) {
      for (const seat of room.seats) {
        // key: homeroom-number
        studentMap.set(`${seat.homeroom}-${seat.number}`, { ...seat, roomNumber: room.roomNumber });
      }
    }

    session.days.forEach((day, di) => {
      const slots = gradeConfig.slotConfigs[di] ?? [];
      if (slots.length === 0) return;

      slots.forEach((_slot, si) => {
        // 이 교시에 배치된 과목명들
        const thisSubjects = getSubjectNames(gi, di, si);

        // 이 날 이 교시 이후에 배치된 과목명들 수집
        const laterSubjects: string[] = [];
        for (let lsi = si + 1; lsi < slots.length; lsi++) {
          laterSubjects.push(...getSubjectNames(gi, di, lsi));
        }

        // 이 교시 이후 교시가 없으면 대기자 없음
        if (laterSubjects.length === 0) return;
        // 이 교시에 아무 과목도 없으면 대기자 계산 불필요 (전원 이 교시 없음 처리)
        if (thisSubjects.length === 0) return;

        // 대기자: 이 교시 과목 미응시 && 이후 교시 과목 응시
        const waiters: WaitingEntry[] = [];

        for (const room of result.rooms) {
          for (const seat of room.seats) {
            // 이 교시 과목 응시 여부
            const takesThis = thisSubjects.some(subName => {
              const idx = result.subjectNames.findIndex(n => n === subName || n.includes(subName) || subName.includes(n));
              return idx >= 0 && seat.subjectFlags[idx] === 1;
            });
            if (takesThis) continue; // 응시자는 대기자 아님

            // 이후 교시 중 하나라도 응시하는지
            const takesLater = laterSubjects.some(subName => {
              const idx = result.subjectNames.findIndex(n => n === subName || n.includes(subName) || subName.includes(n));
              return idx >= 0 && seat.subjectFlags[idx] === 1;
            });
            if (!takesLater) continue;

            // 다음 시험 교시 찾기
            let nextLabel = '';
            for (let lsi = si + 1; lsi < slots.length; lsi++) {
              const lSubjects = getSubjectNames(gi, di, lsi);
              const takes = lSubjects.some(subName => {
                const idx = result.subjectNames.findIndex(n => n === subName || n.includes(subName) || subName.includes(n));
                return idx >= 0 && seat.subjectFlags[idx] === 1;
              });
              if (takes) {
                const lSlot = slots[lsi];
                nextLabel = `${day.date || `${di + 1}일차`} ${lsi + 1}교시 ${lSubjects.join('/')} (${lSlot.startTime})`;
                break;
              }
            }

            waiters.push({
              roomNumber: room.roomNumber,
              seatNumber: seat.seatNumber,
              homeroom:   seat.homeroom,
              number:     seat.number,
              name:       seat.name,
              nextPeriodLabel: nextLabel,
            });
          }
        }

        if (waiters.length === 0) return;

        const dayLabel   = day.date || `${di + 1}일차`;
        const subjLabel  = thisSubjects.join('/');
        const sectionKey = `${gi}-${di}-${si}`;

        sections.push(
          <div key={sectionKey} className={styles.section}>
            <div className={styles.sectionHeader} style={{ background: color.bg, color: color.text }}>
              <strong>{gradeConfig.grade}학년 대기자 명단</strong>
              <span className={styles.periodLabel}>{dayLabel} {si + 1}교시 ({subjLabel}) — 총 {waiters.length}명</span>
            </div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>응시반/번호</th>
                  <th className={styles.th}>반</th>
                  <th className={styles.th}>번호</th>
                  <th className={styles.th}>이름</th>
                  <th className={styles.th}>다음 시험</th>
                </tr>
              </thead>
              <tbody>
                {waiters.sort((a, b) => a.roomNumber !== b.roomNumber ? a.roomNumber - b.roomNumber : a.seatNumber - b.seatNumber)
                  .map(w => (
                    <tr key={`${w.roomNumber}-${w.seatNumber}`}>
                      <td className={styles.td}>{w.roomNumber}반/{String(w.seatNumber).padStart(2, '0')}번</td>
                      <td className={styles.td}>{w.homeroom}</td>
                      <td className={styles.td}>{w.number}</td>
                      <td className={styles.tdName}>{w.name}</td>
                      <td className={styles.tdNext}>{w.nextPeriodLabel}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        );
      });
    });
  });

  if (sections.length === 0) {
    return (
      <div className={styles.empty}>
        대기자가 없거나 응시반 편성 데이터가 없습니다.<br />
        (한 교시가 끝난 뒤 같은 날 이후 교시에 시험이 있는 학생이 대기자입니다.)
      </div>
    );
  }

  return <div>{sections}</div>;
}
