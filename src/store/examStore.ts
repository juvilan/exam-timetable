import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ExamSession, Subject, SubjectGroup, GridCell, CellContent,
  DayConfig, GradeConfig, SlotConfig, GaImportData, GradeMatrix, SeatingResult,
} from '../types';
import { genId } from '../utils/id';
import { createDefaultExamSession, defaultGradeConfig, defaultSlots, defaultSlotsForGrade, DEFAULT_PERIOD_TIMES, isSubjectActive } from '../utils/examDefaults';

// ============================================================
// 스토어 타입
// ============================================================

type View = 'list' | 'form' | 'editor';

interface ExamStore {
  // ── 상태 ──────────────────────────────────────────────────
  sessions: ExamSession[];
  activeSessionId: string | null;
  view: View;

  // ── 네비게이션 ────────────────────────────────────────────
  openList: () => void;
  openNew: () => void;
  openSession: (id: string) => void;
  openEditor: (id: string) => void;

  // ── 고사 CRUD ─────────────────────────────────────────────
  createSession: (partial?: Partial<Pick<ExamSession, 'title' | 'schoolYear' | 'semester' | 'examType'>>) => string;
  updateSession: (id: string, patch: Partial<ExamSession>) => void;
  deleteSession: (id: string) => void;
  duplicateSession: (id: string) => string;

  // ── 날짜 관리 ─────────────────────────────────────────────
  addDay: (sessionId: string) => void;
  updateDay: (sessionId: string, dayIdx: number, patch: Partial<DayConfig>) => void;
  removeDay: (sessionId: string, dayIdx: number) => void;
  setDateRange: (sessionId: string, startDate: string, endDate: string) => void;

  // ── 학년 설정 ─────────────────────────────────────────────
  addGrade: (sessionId: string, grade: 1 | 2 | 3) => void;
  removeGrade: (sessionId: string, grade: 1 | 2 | 3) => void;
  updateGradeConfig: (sessionId: string, gradeIdx: number, patch: Partial<GradeConfig>) => void;
  updateSlot: (sessionId: string, gradeIdx: number, dayIdx: number, slotIdx: number, patch: Partial<SlotConfig>) => void;
  addSlot: (sessionId: string, gradeIdx: number, dayIdx: number) => void;
  removeSlot: (sessionId: string, gradeIdx: number, dayIdx: number, slotIdx: number) => void;
  setPeriodTimeAll: (sessionId: string, periodIdx: number, patch: Partial<SlotConfig>) => void;
  setGradePeriodCount: (sessionId: string, grade: 1 | 2 | 3, count: number) => void;

  // ── 과목 관리 ─────────────────────────────────────────────
  addSubject: (sessionId: string, subject: Omit<Subject, 'id'>) => string;
  updateSubject: (sessionId: string, subjectId: string, patch: Partial<Subject>) => void;
  removeSubject: (sessionId: string, subjectId: string) => void;
  importSubjectsFromGa: (sessionId: string, data: GaImportData) => void;

  // ── 그룹 관리 ─────────────────────────────────────────────
  addGroup: (sessionId: string, group: Omit<SubjectGroup, 'id'>) => string;
  updateGroup: (sessionId: string, groupId: string, patch: Partial<SubjectGroup>) => void;
  removeGroup: (sessionId: string, groupId: string) => void;

  // ── 그리드 배치 ───────────────────────────────────────────
  setCell: (sessionId: string, cell: Omit<GridCell, 'content'>, content: CellContent | null) => void;
  clearCell: (sessionId: string, gradeIndex: number, dayIndex: number, slotIndex: number) => void;
  moveCell: (sessionId: string, from: Omit<GridCell, 'content'>, to: Omit<GridCell, 'content'>) => void;
  toggleGroupSubject: (sessionId: string, gradeIndex: number, dayIndex: number, slotIndex: number, subjectId: string) => void;

  // ── GA 가져오기 ───────────────────────────────────────────
  applyGaOrder: (sessionId: string, data: GaImportData) => void;

  // ── 학생-과목 행렬 (GA 최적화용) ──────────────────────────
  setGradeMatrix: (sessionId: string, matrix: GradeMatrix) => void;

  // ── 응시반 배정 결과 ──────────────────────────────────────
  setSeatingResult: (sessionId: string, result: SeatingResult) => void;

  // ── JSON 내보내기/가져오기 ────────────────────────────────
  exportSession: (id: string) => string;
  importSession: (json: string) => string;
}

// ============================================================
// 헬퍼
// ============================================================

function findSession(sessions: ExamSession[], id: string): ExamSession | undefined {
  return sessions.find(s => s.id === id);
}

function updateSessionInList(
  sessions: ExamSession[],
  id: string,
  updater: (s: ExamSession) => ExamSession
): ExamSession[] {
  return sessions.map(s => (s.id === id ? { ...updater(s), updatedAt: new Date().toISOString() } : s));
}

function findCell(grid: GridCell[], g: number, d: number, sl: number): GridCell | undefined {
  return grid.find(c => c.gradeIndex === g && c.dayIndex === d && c.slotIndex === sl);
}

function upsertCell(grid: GridCell[], cell: GridCell): GridCell[] {
  const exists = grid.some(c => c.gradeIndex === cell.gradeIndex && c.dayIndex === cell.dayIndex && c.slotIndex === cell.slotIndex);
  if (exists) {
    return grid.map(c =>
      c.gradeIndex === cell.gradeIndex && c.dayIndex === cell.dayIndex && c.slotIndex === cell.slotIndex
        ? cell
        : c
    );
  }
  return [...grid, cell];
}

function removeCell(grid: GridCell[], g: number, d: number, sl: number): GridCell[] {
  return grid.filter(c => !(c.gradeIndex === g && c.dayIndex === d && c.slotIndex === sl));
}

// ============================================================
// 스토어
// ============================================================

export const useExamStore = create<ExamStore>()(
  persist(
    (set, get) => ({
      sessions:        [],
      activeSessionId: null,
      view:            'list',

      // ── 네비게이션 ──────────────────────────────────────
      openList:  () => set({ view: 'list', activeSessionId: null }),
      openNew:   () => set({ view: 'form', activeSessionId: null }),
      openSession: (id) => set({ view: 'form', activeSessionId: id }),
      openEditor:  (id) => set({ view: 'editor', activeSessionId: id }),

      // ── 고사 CRUD ───────────────────────────────────────
      createSession: (partial) => {
        const session = createDefaultExamSession(partial);
        set(state => ({ sessions: [...state.sessions, session] }));
        return session.id;
      },

      updateSession: (id, patch) => {
        set(state => ({
          sessions: updateSessionInList(state.sessions, id, s => ({ ...s, ...patch })),
        }));
      },

      deleteSession: (id) => {
        set(state => ({
          sessions:        state.sessions.filter(s => s.id !== id),
          activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
          view:            state.activeSessionId === id ? 'list' : state.view,
        }));
      },

      duplicateSession: (id) => {
        const src = findSession(get().sessions, id);
        if (!src) return id;
        const now  = new Date().toISOString();
        const copy = { ...src, id: genId('exam'), title: `${src.title} (복사본)`, createdAt: now, updatedAt: now };
        set(state => ({ sessions: [...state.sessions, copy] }));
        return copy.id;
      },

      // ── 날짜 관리 ───────────────────────────────────────
      addDay: (sessionId) => {
        set(state => ({
          sessions: updateSessionInList(state.sessions, sessionId, s => {
            if (s.days.length >= 5) return s;
            const newDay: DayConfig = { id: genId('day'), date: '' };
            const newDays = [...s.days, newDay];
            const newGrades = s.grades.map(g => ({
              ...g,
              slotConfigs: [...g.slotConfigs, defaultSlots()],
            }));
            return { ...s, days: newDays, grades: newGrades };
          }),
        }));
      },

      updateDay: (sessionId, dayIdx, patch) => {
        set(state => ({
          sessions: updateSessionInList(state.sessions, sessionId, s => {
            const days = s.days.map((d, i) => (i === dayIdx ? { ...d, ...patch } : d));
            return { ...s, days };
          }),
        }));
      },

      removeDay: (sessionId, dayIdx) => {
        set(state => ({
          sessions: updateSessionInList(state.sessions, sessionId, s => {
            if (s.days.length <= 1) return s;
            const days   = s.days.filter((_, i) => i !== dayIdx);
            const grades = s.grades.map(g => ({
              ...g,
              slotConfigs: g.slotConfigs.filter((_, i) => i !== dayIdx),
            }));
            const grid = s.grid
              .filter(c => c.dayIndex !== dayIdx)
              .map(c => ({ ...c, dayIndex: c.dayIndex > dayIdx ? c.dayIndex - 1 : c.dayIndex }));
            return { ...s, days, grades, grid };
          }),
        }));
      },

      setDateRange: (sessionId, startDate, endDate) => {
        // 평일(월~금)만 추출 (최대 10일)
        const weekdays: string[] = [];
        const d = new Date(startDate + 'T12:00:00');
        const end = new Date(endDate + 'T12:00:00');
        while (d <= end && weekdays.length < 10) {
          const dow = d.getDay();
          if (dow !== 0 && dow !== 6) weekdays.push(d.toISOString().slice(0, 10));
          d.setDate(d.getDate() + 1);
        }
        if (weekdays.length === 0) return;
        set(state => ({
          sessions: updateSessionInList(state.sessions, sessionId, s => {
            const newDays = weekdays.map(date => ({ id: genId('day'), date }));
            const newGrades = s.grades.map(g => ({
              ...g,
              slotConfigs: weekdays.map((_, di) =>
                g.slotConfigs[di] ?? g.slotConfigs[0] ?? defaultSlotsForGrade(g.grade)
              ),
            }));
            const grid = s.grid.filter(c => c.dayIndex < weekdays.length);
            return { ...s, days: newDays, grades: newGrades, grid };
          }),
        }));
      },

      // ── 학년 설정 ───────────────────────────────────────
      addGrade: (sessionId, grade) => {
        set(state => ({
          sessions: updateSessionInList(state.sessions, sessionId, s => {
            if (s.grades.some(g => g.grade === grade)) return s;
            const newGrade = defaultGradeConfig(grade, s.days.length);
            const grades   = [...s.grades, newGrade].sort((a, b) => a.grade - b.grade);
            return { ...s, grades };
          }),
        }));
      },

      removeGrade: (sessionId, grade) => {
        set(state => ({
          sessions: updateSessionInList(state.sessions, sessionId, s => {
            const gradeIdx = s.grades.findIndex(g => g.grade === grade);
            if (gradeIdx < 0) return s;
            const grades = s.grades.filter(g => g.grade !== grade);
            const grid   = s.grid
              .filter(c => c.gradeIndex !== gradeIdx)
              .map(c => ({ ...c, gradeIndex: c.gradeIndex > gradeIdx ? c.gradeIndex - 1 : c.gradeIndex }));
            return { ...s, grades, grid };
          }),
        }));
      },

      updateGradeConfig: (sessionId, gradeIdx, patch) => {
        set(state => ({
          sessions: updateSessionInList(state.sessions, sessionId, s => {
            const grades = s.grades.map((g, i) => (i === gradeIdx ? { ...g, ...patch } : g));
            return { ...s, grades };
          }),
        }));
      },

      updateSlot: (sessionId, gradeIdx, dayIdx, slotIdx, patch) => {
        set(state => ({
          sessions: updateSessionInList(state.sessions, sessionId, s => {
            const grades = s.grades.map((g, gi) => {
              if (gi !== gradeIdx) return g;
              const slotConfigs = g.slotConfigs.map((daySlots, di) => {
                if (di !== dayIdx) return daySlots;
                return daySlots.map((slot, si) => (si === slotIdx ? { ...slot, ...patch } : slot));
              });
              return { ...g, slotConfigs };
            });
            return { ...s, grades };
          }),
        }));
      },

      addSlot: (sessionId, gradeIdx, dayIdx) => {
        set(state => ({
          sessions: updateSessionInList(state.sessions, sessionId, s => {
            const grades = s.grades.map((g, gi) => {
              if (gi !== gradeIdx) return g;
              const slotConfigs = g.slotConfigs.map((daySlots, di) => {
                if (di !== dayIdx) return daySlots;
                const last   = daySlots[daySlots.length - 1];
                const period = (last?.period ?? 0) + 1;
                const newSlot: SlotConfig = { period, startTime: '', endTime: '', durationMin: 50 };
                return [...daySlots, newSlot];
              });
              return { ...g, slotConfigs };
            });
            return { ...s, grades };
          }),
        }));
      },

      setPeriodTimeAll: (sessionId, periodIdx, patch) => {
        set(state => ({
          sessions: updateSessionInList(state.sessions, sessionId, s => {
            const grades = s.grades.map(g => ({
              ...g,
              slotConfigs: g.slotConfigs.map(daySlots =>
                daySlots.map((slot, si) => (si === periodIdx ? { ...slot, ...patch } : slot))
              ),
            }));
            return { ...s, grades };
          }),
        }));
      },

      setGradePeriodCount: (sessionId, grade, count) => {
        if (count < 1 || count > 4) return;
        set(state => ({
          sessions: updateSessionInList(state.sessions, sessionId, s => {
            const gi = s.grades.findIndex(g => g.grade === grade);
            if (gi < 0) return s;
            const g = s.grades[gi];
            const currentCount = g.slotConfigs[0]?.length ?? 0;
            const grades = s.grades.map((gc, i) => {
              if (i !== gi) return gc;
              const slotConfigs = gc.slotConfigs.map(daySlots => {
                if (daySlots.length === count) return daySlots;
                if (daySlots.length > count) return daySlots.slice(0, count);
                const extended = [...daySlots];
                while (extended.length < count) {
                  const pidx = extended.length;
                  const ref = DEFAULT_PERIOD_TIMES[pidx] ?? DEFAULT_PERIOD_TIMES[3];
                  const [h, m] = ref.startTime.split(':').map(Number);
                  const total = h * 60 + m + ref.durationMin;
                  const endTime = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
                  extended.push({ period: pidx + 1, startTime: ref.startTime, endTime, durationMin: ref.durationMin });
                }
                return extended;
              });
              return { ...gc, slotConfigs };
            });
            const grid = count < currentCount
              ? s.grid.filter(c => !(c.gradeIndex === gi && c.slotIndex >= count))
              : s.grid;
            return { ...s, grades, grid };
          }),
        }));
      },

      removeSlot: (sessionId, gradeIdx, dayIdx, slotIdx) => {
        set(state => ({
          sessions: updateSessionInList(state.sessions, sessionId, s => {
            const grades = s.grades.map((g, gi) => {
              if (gi !== gradeIdx) return g;
              const slotConfigs = g.slotConfigs.map((daySlots, di) => {
                if (di !== dayIdx) return daySlots;
                return daySlots.filter((_, si) => si !== slotIdx);
              });
              return { ...g, slotConfigs };
            });
            const grid = s.grid.filter(c =>
              !(c.gradeIndex === gradeIdx && c.dayIndex === dayIdx && c.slotIndex === slotIdx)
            );
            return { ...s, grades, grid };
          }),
        }));
      },

      // ── 과목 관리 ───────────────────────────────────────
      addSubject: (sessionId, subject) => {
        const id = genId('subj');
        set(state => ({
          sessions: updateSessionInList(state.sessions, sessionId, s => ({
            ...s,
            subjects: [...s.subjects, { ...subject, id }],
          })),
        }));
        return id;
      },

      updateSubject: (sessionId, subjectId, patch) => {
        set(state => ({
          sessions: updateSessionInList(state.sessions, sessionId, s => ({
            ...s,
            subjects: s.subjects.map(sub => (sub.id === subjectId ? { ...sub, ...patch } : sub)),
          })),
        }));
      },

      removeSubject: (sessionId, subjectId) => {
        set(state => ({
          sessions: updateSessionInList(state.sessions, sessionId, s => {
            const subjects = s.subjects.filter(sub => sub.id !== subjectId);
            const grid     = s.grid.filter(c => {
              if (!c.content) return true;
              if (c.content.type === 'single') return c.content.subjectId !== subjectId;
              return true;
            });
            return { ...s, subjects, grid };
          }),
        }));
      },

      importSubjectsFromGa: (sessionId, data) => {
        // GA 결과(과목명 배열)로 기존 과목의 groupId를 자동 매핑 시도
        // 실제 배치는 applyGaOrder에서 처리
        get().applyGaOrder(sessionId, data);
      },

      // ── 그룹 관리 ───────────────────────────────────────
      addGroup: (sessionId, group) => {
        const id = genId('grp');
        set(state => ({
          sessions: updateSessionInList(state.sessions, sessionId, s => ({
            ...s,
            groups: [...s.groups, { ...group, id }],
          })),
        }));
        return id;
      },

      updateGroup: (sessionId, groupId, patch) => {
        set(state => ({
          sessions: updateSessionInList(state.sessions, sessionId, s => ({
            ...s,
            groups: s.groups.map(g => (g.id === groupId ? { ...g, ...patch } : g)),
          })),
        }));
      },

      removeGroup: (sessionId, groupId) => {
        set(state => ({
          sessions: updateSessionInList(state.sessions, sessionId, s => {
            const groups   = s.groups.filter(g => g.id !== groupId);
            const subjects = s.subjects.map(sub =>
              sub.groupId === groupId ? { ...sub, groupId: null } : sub
            );
            const grid = s.grid.filter(c => {
              if (!c.content) return true;
              if (c.content.type === 'group') return c.content.groupId !== groupId;
              return true;
            });
            return { ...s, groups, subjects, grid };
          }),
        }));
      },

      // ── 그리드 배치 ─────────────────────────────────────
      setCell: (sessionId, { gradeIndex, dayIndex, slotIndex }, content) => {
        set(state => ({
          sessions: updateSessionInList(state.sessions, sessionId, s => {
            const grid = content === null
              ? removeCell(s.grid, gradeIndex, dayIndex, slotIndex)
              : upsertCell(s.grid, { gradeIndex, dayIndex, slotIndex, content });
            return { ...s, grid };
          }),
        }));
      },

      clearCell: (sessionId, gradeIndex, dayIndex, slotIndex) => {
        set(state => ({
          sessions: updateSessionInList(state.sessions, sessionId, s => ({
            ...s,
            grid: removeCell(s.grid, gradeIndex, dayIndex, slotIndex),
          })),
        }));
      },

      moveCell: (sessionId, from, to) => {
        set(state => ({
          sessions: updateSessionInList(state.sessions, sessionId, s => {
            const fromCell = findCell(s.grid, from.gradeIndex, from.dayIndex, from.slotIndex);
            const toCell   = findCell(s.grid, to.gradeIndex, to.dayIndex, to.slotIndex);
            if (!fromCell) return s;

            let grid = removeCell(s.grid, from.gradeIndex, from.dayIndex, from.slotIndex);
            grid     = removeCell(grid, to.gradeIndex, to.dayIndex, to.slotIndex);
            grid     = upsertCell(grid, { ...to, content: fromCell.content });

            // from 위치에 기존 to 셀 내용 배치 (swap)
            if (toCell?.content) {
              grid = upsertCell(grid, { ...from, content: toCell.content });
            }
            return { ...s, grid };
          }),
        }));
      },

      toggleGroupSubject: (sessionId, gradeIndex, dayIndex, slotIndex, subjectId) => {
        set(state => ({
          sessions: updateSessionInList(state.sessions, sessionId, s => {
            const cell = findCell(s.grid, gradeIndex, dayIndex, slotIndex);
            if (!cell?.content || cell.content.type !== 'group') return s;
            const active = cell.content.activeSubjectIds;
            const newActive = active.includes(subjectId)
              ? active.filter(id => id !== subjectId)
              : [...active, subjectId];
            const grid = upsertCell(s.grid, {
              ...cell,
              content: { ...cell.content, activeSubjectIds: newActive },
            });
            return { ...s, grid };
          }),
        }));
      },

      // ── GA 가져오기 ─────────────────────────────────────
      applyGaOrder: (sessionId, data) => {
        set(state => ({
          sessions: updateSessionInList(state.sessions, sessionId, s => {
            const { periodCodeMap } = data;
            if (!periodCodeMap) return s;

            // periodCodeMap: { "과목명": "11" } → "11" = 1일차 1교시
            let grid = s.grid.filter(c => !c.content); // 기존 배치 유지 전략: 전체 초기화
            grid = [];

            for (const [subjName, code] of Object.entries(periodCodeMap)) {
              const subject = s.subjects.find(sub => sub.name === subjName);
              if (!subject) continue;

              const codeStr  = String(code);
              const dayIndex  = parseInt(codeStr[0]) - 1;
              const slotIndex = parseInt(codeStr.slice(1)) - 1;

              s.grades.forEach((g, gradeIndex) => {
                if (g.grade !== subject.grade) return;
                if (!isSubjectActive(subject.examScope, s.examType)) return;

                const content: CellContent = subject.groupId
                  ? {
                      type: 'group',
                      groupId: subject.groupId,
                      activeSubjectIds: s.groups
                        .find(gr => gr.id === subject.groupId)
                        ?.subjectIds ?? [subject.id],
                    }
                  : { type: 'single', subjectId: subject.id };

                grid = upsertCell(grid, { gradeIndex, dayIndex, slotIndex, content });
              });
            }

            return { ...s, grid };
          }),
        }));
      },

      setGradeMatrix: (sessionId, matrix) => {
        set(state => ({
          sessions: updateSessionInList(state.sessions, sessionId, s => ({
            ...s,
            gradeMatrices: {
              ...s.gradeMatrices,
              [String(matrix.grade)]: matrix,
            },
          })),
        }));
      },

      setSeatingResult: (sessionId, result) => {
        set(state => ({
          sessions: updateSessionInList(state.sessions, sessionId, s => ({
            ...s,
            seatingResults: {
              ...s.seatingResults,
              [String(result.grade)]: result,
            },
          })),
        }));
      },

      // ── JSON 내보내기/가져오기 ───────────────────────────
      exportSession: (id) => {
        const session = findSession(get().sessions, id);
        if (!session) throw new Error('고사를 찾을 수 없습니다.');
        return JSON.stringify(session, null, 2);
      },

      importSession: (json) => {
        const session = JSON.parse(json) as ExamSession;
        const now     = new Date().toISOString();
        const newId   = genId('exam');
        const imported = { ...session, id: newId, updatedAt: now };
        set(state => ({ sessions: [...state.sessions, imported] }));
        return newId;
      },
    }),
    {
      name: 'exam-timetable-store',
      version: 1,
    }
  )
);

// ============================================================
// 셀렉터 훅
// ============================================================

export function useActiveSession(): ExamSession | null {
  return useExamStore(state => {
    const id = state.activeSessionId;
    return id ? state.sessions.find(s => s.id === id) ?? null : null;
  });
}

export function useSession(id: string): ExamSession | undefined {
  return useExamStore(state => state.sessions.find(s => s.id === id));
}
