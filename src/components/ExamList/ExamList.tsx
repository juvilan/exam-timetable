import { useExamStore } from '../../store/examStore';
import type { ExamSession } from '../../types';
import styles from './ExamList.module.css';

export function ExamList() {
  const { sessions, openNew, openSession, openEditor, deleteSession, duplicateSession, importSession } =
    useExamStore();

  function handleImport() {
    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const id = importSession(ev.target!.result as string);
          openEditor(id);
        } catch {
          alert('JSON 파일을 읽을 수 없습니다.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function handleExport(id: string) {
    const { exportSession } = useExamStore.getState();
    const json = exportSession(id);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `exam-${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>시험 시간표</h1>
        <div className={styles.headerActions}>
          <button className={`${styles.btn} ${styles.btnGhost}`} onClick={handleImport}>
            📥 JSON 가져오기
          </button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={openNew}>
            + 새 고사 만들기
          </button>
        </div>
      </header>

      {sessions.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📋</div>
          <p>고사가 없습니다.</p>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={openNew}>
            첫 번째 고사 만들기
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {sessions.map(session => (
            <ExamCard
              key={session.id}
              session={session}
              onOpen={() => openSession(session.id)}
              onEdit={() => openEditor(session.id)}
              onDuplicate={() => duplicateSession(session.id)}
              onDelete={() => {
                if (confirm(`"${session.title}"을 삭제하시겠습니까?`)) deleteSession(session.id);
              }}
              onExport={() => handleExport(session.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ExamCard({
  session, onOpen, onEdit, onDuplicate, onDelete, onExport,
}: {
  session: ExamSession;
  onOpen: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onExport: () => void;
}) {
  const typeLabel = session.examType === 'mid' ? '중간고사' : '기말고사';
  const gradeList = session.grades.map(g => `${g.grade}학년`).join(' · ');
  const updatedAt = new Date(session.updatedAt).toLocaleDateString('ko-KR');

  return (
    <div className={styles.card}>
      <div className={styles.cardBadge} data-type={session.examType}>
        {session.semester}학기 {typeLabel}
      </div>
      <h2 className={styles.cardTitle} onClick={onEdit}>{session.title}</h2>
      <div className={styles.cardMeta}>
        <span>📅 {session.days.length}일간</span>
        <span>👥 {gradeList}</span>
        <span>📚 {session.subjects.length}과목</span>
      </div>
      <div className={styles.cardFooter}>
        <span className={styles.cardDate}>수정: {updatedAt}</span>
        <div className={styles.cardActions}>
          <button className={styles.iconBtn} onClick={onEdit} title="시간표 편집">✏️</button>
          <button className={styles.iconBtn} onClick={onOpen} title="설정">⚙️</button>
          <button className={styles.iconBtn} onClick={onExport} title="내보내기">💾</button>
          <button className={styles.iconBtn} onClick={onDuplicate} title="복사">📋</button>
          <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={onDelete} title="삭제">🗑</button>
        </div>
      </div>
    </div>
  );
}
