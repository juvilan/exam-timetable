import { useState } from 'react';
import { useExamStore, useActiveSession } from '../../store/examStore';
import { TimetableGrid } from './TimetableGrid';
import { SubjectPanel } from '../SubjectPanel/SubjectPanel';
import { PrintView } from '../Print/PrintView';
import styles from './EditorLayout.module.css';

export function EditorLayout() {
  const session = useActiveSession();
  const { openList, openSession } = useExamStore();
  const [showPrint, setShowPrint] = useState(false);

  if (!session) {
    return <div style={{ padding: 32 }}>고사를 찾을 수 없습니다. <button onClick={openList}>목록으로</button></div>;
  }

  if (showPrint) {
    return (
      <div>
        <div className={styles.topBar}>
          <button className={styles.backBtn} onClick={() => setShowPrint(false)}>← 편집으로</button>
        </div>
        <PrintView session={session} />
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      {/* 상단 바 */}
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={openList}>← 목록</button>
        <h2 className={styles.sessionTitle}>{session.title}</h2>
        <div className={styles.topActions}>
          <button className={styles.btn} onClick={() => openSession(session.id)}>⚙️ 설정</button>
          <button className={styles.btn} onClick={() => setShowPrint(true)}>🖨 인쇄 미리보기</button>
        </div>
      </div>

      {/* 메인 영역 */}
      <div className={styles.main}>
        <div className={styles.gridArea}>
          <TimetableGrid session={session} />
        </div>
        <div className={styles.sidePanel}>
          <SubjectPanel session={session} />
        </div>
      </div>
    </div>
  );
}
