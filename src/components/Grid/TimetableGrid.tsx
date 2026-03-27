import React, { useState } from 'react';
import {
  DndContext, DragOverlay,
  PointerSensor, useSensor, useSensors, useDroppable, useDraggable,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { useExamStore } from '../../store/examStore';
import type { ExamSession, GridCell, CellContent, Subject, SubjectGroup } from '../../types';
import { isSubjectActive } from '../../utils/examDefaults';
import { GRADE_COLORS } from '../../types';
import styles from './TimetableGrid.module.css';

interface Props {
  session: ExamSession;
}

// dnd-kit 드래그 ID 인코딩
type DragSource =
  | { kind: 'cell'; gradeIndex: number; dayIndex: number; slotIndex: number }
  | { kind: 'palette'; subjectId: string };

function encodeDragId(src: DragSource): string {
  return JSON.stringify(src);
}
function decodeDragId(id: string): DragSource | null {
  try { return JSON.parse(id); } catch { return null; }
}
function encodeDropId(g: number, d: number, s: number) {
  return `drop:${g}:${d}:${s}`;
}
function decodeDropId(id: string): { g: number; d: number; s: number } | null {
  const parts = String(id).split(':');
  if (parts[0] !== 'drop') return null;
  return { g: Number(parts[1]), d: Number(parts[2]), s: Number(parts[3]) };
}

export function TimetableGrid({ session }: Props) {
  const { setCell, moveCell, clearCell } = useExamStore();
  const [dragging, setDragging] = useState<DragSource | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const maxSlots = Math.max(
    ...session.grades.flatMap(g => g.slotConfigs.flatMap(day => day.length)),
    0
  );

  function getCell(gi: number, di: number, si: number): GridCell | undefined {
    return session.grid.find(c => c.gradeIndex === gi && c.dayIndex === di && c.slotIndex === si);
  }

  function getSubject(id: string): Subject | undefined {
    return session.subjects.find(s => s.id === id);
  }

  function getGroup(id: string): SubjectGroup | undefined {
    return session.groups.find(g => g.id === id);
  }

  function contentToDisplay(content: CellContent): { label: string; groupType?: string; warning?: string } {
    if (content.type === 'single') {
      const subj    = getSubject(content.subjectId);
      const active  = subj ? isSubjectActive(subj.examScope, session.examType) : false;
      return {
        label:   subj?.name ?? '(삭제된 과목)',
        warning: !active ? '이 고사에 응시하지 않는 과목입니다' : undefined,
      };
    }
    const group = getGroup(content.groupId);
    const names = content.activeSubjectIds
      .map(id => getSubject(id)?.name ?? id)
      .join(' / ');
    return { label: names || (group?.displayLabel ?? ''), groupType: group?.groupType };
  }

  function handleDragStart(event: DragStartEvent) {
    const src = decodeDragId(String(event.active.id));
    setDragging(src);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragging(null);
    const { active, over } = event;
    if (!over) return;

    const drop = decodeDropId(String(over.id));
    if (!drop) return;

    const src = decodeDragId(String(active.id));
    if (!src) return;

    const { g, d, s } = drop;

    if (src.kind === 'palette') {
      // 팔레트 → 그리드 배치
      const subject = getSubject(src.subjectId);
      if (!subject) return;

      if (!isSubjectActive(subject.examScope, session.examType)) {
        if (!confirm(`"${subject.name}"은(는) 이 고사의 응시 범위에 포함되지 않습니다. 그래도 배치하겠습니까?`)) return;
      }

      const content: CellContent = subject.groupId
        ? {
            type: 'group',
            groupId: subject.groupId,
            activeSubjectIds: getGroup(subject.groupId)?.subjectIds ?? [subject.id],
          }
        : { type: 'single', subjectId: subject.id };

      setCell(session.id, { gradeIndex: g, dayIndex: d, slotIndex: s }, content);
    } else if (src.kind === 'cell') {
      // 그리드 → 그리드 이동 (swap)
      moveCell(
        session.id,
        { gradeIndex: src.gradeIndex, dayIndex: src.dayIndex, slotIndex: src.slotIndex },
        { gradeIndex: g, dayIndex: d, slotIndex: s }
      );
    }
  }

  // 현재 드래그 중인 셀의 내용
  const dragOverlay = (() => {
    if (!dragging) return null;
    if (dragging.kind === 'palette') {
      const subj = getSubject(dragging.subjectId);
      return <DragCard label={subj?.name ?? ''} />;
    }
    const cell = getCell(dragging.gradeIndex, dragging.dayIndex, dragging.slotIndex);
    if (!cell?.content) return null;
    const { label } = contentToDisplay(cell.content);
    return <DragCard label={label} />;
  })();

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className={styles.layout}>
        {/* 시간표 그리드 */}
        <div className={styles.gridWrap}>
          <table className={styles.grid}>
            <thead>
              <tr>
                <th className={styles.cornerCell}></th>
                {session.days.map((day, di) => (
                  <th key={day.id} className={styles.dayHeader}>
                    <div className={styles.dayHeaderInner}>
                      <span className={styles.dayNum}>{di + 1}일차</span>
                      {day.date && <span className={styles.dayDate}>{day.date}</span>}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {session.grades.map((gradeConfig, gi) => {
                const color = GRADE_COLORS[gradeConfig.grade];

                return (
                  <React.Fragment key={gi}>
                    {/* 시차등교 행 */}
                    {gradeConfig.arrivalTime && (
                      <tr key={`arrival-${gi}`} className={styles.arrivalRow}>
                        <td className={styles.rowLabel} style={{ background: color.bg, color: color.text }}>
                          <span className={styles.gradeBadge} style={{ background: color.bg, color: color.text }}>
                            {gradeConfig.grade}학년
                          </span>
                          <span className={styles.arrivalLabel}>등교 {gradeConfig.arrivalTime}</span>
                        </td>
                        {session.days.map((_day, di) => (
                          <td key={di} className={styles.arrivalCell} style={{ background: color.bg }}>
                            <span className={styles.arrivalTime}>{gradeConfig.arrivalTime} 등교</span>
                          </td>
                        ))}
                      </tr>
                    )}

                    {/* 교시 행 */}
                    {Array.from({ length: maxSlots }).map((_, si) => {
                      const hasAnySlot = session.grades.some(g => g.slotConfigs.some(day => day[si]));
                      if (!hasAnySlot) return null;

                      const slot = gradeConfig.slotConfigs[0]?.[si];

                      return (
                        <tr key={`${gi}-${si}`} className={styles.slotRow}>
                          <td className={styles.rowLabel}>
                            {si === 0 && !gradeConfig.arrivalTime && (
                              <span className={styles.gradeBadge} style={{ background: color.bg, color: color.text }}>
                                {gradeConfig.grade}학년
                              </span>
                            )}
                            <span className={styles.periodLabel}>{si + 1}교시</span>
                            {slot && <span className={styles.timeLabel}>{slot.startTime}~{slot.endTime}</span>}
                          </td>

                          {session.days.map((_day, di) => {
                            const daySlot = gradeConfig.slotConfigs[di]?.[si];
                            const cell    = getCell(gi, di, si);

                            return (
                              <GridDropCell
                                key={di}
                                gradeIndex={gi}
                                dayIndex={di}
                                slotIndex={si}
                                cell={cell}
                                isValidSlot={!!daySlot}
                                onClear={() => clearCell(session.id, gi, di, si)}
                                contentToDisplay={contentToDisplay}
                                gradeColor={color}
                              />
                            );
                          })}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 과목 팔레트 */}
        <div className={styles.palette}>
          <div className={styles.paletteTitle}>미배치 과목</div>
          {session.grades.map((gc, gi) => {
            const unplaced = session.subjects.filter(s => {
              if (s.grade !== gc.grade) return false;
              if (!isSubjectActive(s.examScope, session.examType)) return false;
              return !session.grid.some(c => {
                if (!c.content) return false;
                if (c.content.type === 'single') return c.content.subjectId === s.id;
                return c.content.activeSubjectIds.includes(s.id);
              });
            });

            if (!unplaced.length) return null;
            return (
              <div key={gi}>
                <div className={styles.paletteGradeLabel} data-grade={gc.grade}>
                  {gc.grade}학년
                </div>
                {unplaced.map(s => (
                  <PaletteCard key={s.id} subject={s} />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <DragOverlay>{dragOverlay}</DragOverlay>
    </DndContext>
  );
}

// ── 드롭 셀 ──────────────────────────────────────────────────
function GridDropCell({
  gradeIndex, dayIndex, slotIndex, cell, isValidSlot,
  onClear, contentToDisplay, gradeColor,
}: {
  gradeIndex: number;
  dayIndex: number;
  slotIndex: number;
  cell: GridCell | undefined;
  isValidSlot: boolean;
  onClear: () => void;
  contentToDisplay: (c: CellContent) => { label: string; groupType?: string; warning?: string };
  gradeColor: { bg: string; text: string; border: string };
}) {
  const { setNodeRef, isOver } = useDroppable({ id: encodeDropId(gradeIndex, dayIndex, slotIndex) });

  if (!isValidSlot) {
    return <td className={styles.invalidCell} />;
  }

  const display = cell?.content ? contentToDisplay(cell.content) : null;

  return (
    <td
      ref={setNodeRef}
      className={`${styles.dropCell} ${isOver ? styles.dropCellOver : ''} ${display?.warning ? styles.dropCellWarn : ''}`}
    >
      {cell?.content && display ? (
        <DraggableCell
          gradeIndex={gradeIndex}
          dayIndex={dayIndex}
          slotIndex={slotIndex}
          display={display}
          onClear={onClear}
          gradeColor={gradeColor}
        />
      ) : (
        <div className={styles.emptyCell} />
      )}
    </td>
  );
}

// ── 드래그 가능한 배치된 과목 카드 ──────────────────────────
function DraggableCell({
  gradeIndex, dayIndex, slotIndex, display, onClear, gradeColor,
}: {
  gradeIndex: number;
  dayIndex: number;
  slotIndex: number;
  display: { label: string; groupType?: string; warning?: string };
  onClear: () => void;
  gradeColor: { bg: string; text: string; border: string };
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: encodeDragId({ kind: 'cell', gradeIndex, dayIndex, slotIndex }),
  });

  return (
    <div
      ref={setNodeRef}
      className={`${styles.cellCard} ${isDragging ? styles.cellCardDragging : ''}`}
      style={{ borderColor: gradeColor.border }}
      {...listeners}
      {...attributes}
    >
      <span className={styles.cellLabel}>{display.label}</span>
      {display.groupType && (
        <span className={styles.groupTypeBadge} data-gtype={display.groupType}>
          {display.groupType === 'class_split' ? '반분할' : display.groupType === 'elective' ? '선택' : '문화'}
        </span>
      )}
      {display.warning && <span className={styles.warnIcon} title={display.warning}>⚠️</span>}
      <button
        className={styles.clearBtn}
        onClick={e => { e.stopPropagation(); onClear(); }}
        title="제거"
      >✕</button>
    </div>
  );
}

// ── 팔레트 드래그 카드 ───────────────────────────────────────
function PaletteCard({ subject }: { subject: Subject }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: encodeDragId({ kind: 'palette', subjectId: subject.id }),
  });

  return (
    <div
      ref={setNodeRef}
      className={`${styles.paletteCard} ${isDragging ? styles.paletteCardDragging : ''}`}
      {...listeners}
      {...attributes}
    >
      {subject.name}
      {subject.concentratedClass && (
        <span className={styles.paletteConcentrated}>{subject.concentratedClass}</span>
      )}
    </div>
  );
}

// ── 드래그 오버레이 카드 ─────────────────────────────────────
function DragCard({ label }: { label: string }) {
  return <div className={styles.dragOverlay}>{label}</div>;
}
