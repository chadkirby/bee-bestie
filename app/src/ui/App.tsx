import { Routes, Route, Navigate } from 'react-router-dom';
import PuzzlePage, { RedirectToToday, PuzzleRedirect } from './PuzzlePage';
import WordPage from './WordPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RedirectToToday />} />
      <Route path="/puzzle/:date" element={<PuzzleRedirect />} />
      <Route path="/puzzle/:date/:tab" element={<PuzzlePage />} />
      <Route path="/word/:word" element={<WordPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
