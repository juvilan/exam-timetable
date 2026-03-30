import { useState } from 'react';
import type { ExamSession } from '../../types';
import { exportExcel } from '../../utils/excelExport';
import styles from './ExportPanel.module.css';

interface Props {
  session: ExamSession;
}

type GradeOption = 2 | 3 | 'all';

export function ExportPanel({ session }: Props) {
  const [grade, setGrade] = useState<GradeOption>('all');
  const [exporting, setExporting] = useState(false);

  const hasGrade2 = session.grades.some(g => g.grade === 2);
  const hasGrade3 = session.grades.some(g => g.grade === 3);
  const hasMatrix2 = !!session.gradeMatrices?.['2'];
  const hasMatrix3 = !!session.gradeMatrices?.['3'];

  function handleExport() {
    setExporting(true);
    try {
      exportExcel(session, { grade });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className={styles.panel}>
      <h3 className={styles.title}>💾 Excel 내보내기</h3>

      <div className={styles.gradeSelect}>
        {hasGrade2 && (
          <label className={styles.gradeOption}>
            <input type="radio" name="grade" value="2" checked={grade === 2} onChange={() => setGrade(2)} />
            2학년 {hasMatrix2 ? '✅' : '(기본)'}
          </label>
        )}
        {hasGrade3 && (
          <label className={styles.gradeOption}>
            <input type="radio" name="grade" value="3" checked={grade === 3} onChange={() => setGrade(3)} />
            3학년 {hasMatrix3 ? '✅' : '(기본)'}
          </label>
        )}
        {hasGrade2 && hasGrade3 && (
          <label className={styles.gradeOption}>
            <input type="radio" name="grade" value="all" checked={grade === 'all'} onChange={() => setGrade('all')} />
            전체
          </label>
        )}
      </div>

      <p className={styles.hint}>
        ✅ = 선택과목 Excel 로드됨 (교시별응시현황 시트 포함)<br />
        (기본) = 시험시간표 + 교시코드 시트만 생성
      </p>

      <button className={styles.downloadBtn} onClick={handleExport} disabled={exporting}>
        {exporting ? '생성 중...' : '📥 다운로드'}
      </button>
    </div>
  );
}
