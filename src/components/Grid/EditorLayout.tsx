import { useState } from 'react';
import { useExamStore, useActiveSession } from '../../store/examStore';
import { TimetableGrid } from './TimetableGrid';
import { SubjectPanel } from '../SubjectPanel/SubjectPanel';
import { OptimizePanel } from '../Optimize/OptimizePanel';
import { PrintView } from '../Print/PrintView';
import styles from './EditorLayout.module.css';

type SideTab = 'optimize' | 'subjects';

export function EditorLayout() {
  const session = useActiveSession();
  const { openList, openSession } = useExamStore();
  const [showPrint, setShowPrint] = useState(false);
  const [sideTab, setSideTab]     = useState<SideTab>('optimize');

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
          {/* 사이드 탭 */}
          <div className={styles.sideTabs}>
            <button
              className={`${styles.sideTab} ${sideTab === 'optimize' ? styles.sideTabActive : ''}`}
              onClick={() => setSideTab('optimize')}
            >🤖 최적화</button>
            <button
              className={`${styles.sideTab} ${sideTab === 'subjects' ? styles.sideTabActive : ''}`}
              onClick={() => setSideTab('subjects')}
            >📚 과목·그룹</button>
          </div>
          {sideTab === 'optimize'
            ? <OptimizePanel session={session} />
            : <SubjectPanel session={session} />
          }
        </div>
      </div>
    </div>
  );
}
