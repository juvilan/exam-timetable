import { useExamStore } from './store/examStore';
import { ExamList }    from './components/ExamList/ExamList';
import { ExamForm }    from './components/ExamForm/ExamForm';
import { EditorLayout } from './components/Grid/EditorLayout';

export default function App() {
  const view = useExamStore(state => state.view);

  return (
    <>
      {view === 'list'   && <ExamList />}
      {view === 'form'   && <ExamForm />}
      {view === 'editor' && <EditorLayout />}
    </>
  );
}
