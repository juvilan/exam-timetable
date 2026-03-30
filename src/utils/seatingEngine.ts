import type { GradeMatrix, SeatingResult, SeatingRoom, SeatedStudent } from '../types';

/**
 * 응시반 편성 엔진
 * - 학생을 원반(담임반) → 번호 순으로 정렬
 * - roomCapacity씩 묶어 응시반 1반, 2반, ... 배정
 */
export function assignSeating(matrix: GradeMatrix, roomCapacity = 28): SeatingResult {
  const { grade, subjectNames, students, matrix: flags } = matrix;

  if (!students || students.length === 0) {
    return { grade, rooms: [], subjectNames };
  }

  // 학생 정렬: 원반 → 번호
  const indexed = students.map((s, i) => ({ ...s, idx: i }));
  indexed.sort((a, b) => a.homeroom !== b.homeroom ? a.homeroom - b.homeroom : a.number - b.number);

  const rooms: SeatingRoom[] = [];
  let current: SeatedStudent[] = [];

  for (const s of indexed) {
    current.push({
      seatNumber: current.length + 1,
      homeroom:   s.homeroom,
      number:     s.number,
      name:       s.name,
      subjectFlags: flags[s.idx],
    });
    if (current.length >= roomCapacity) {
      rooms.push({ roomNumber: rooms.length + 1, seats: current });
      current = [];
    }
  }
  if (current.length > 0) {
    rooms.push({ roomNumber: rooms.length + 1, seats: current });
  }

  return { grade, rooms, subjectNames };
}
