import { Routes, Route, Navigate } from 'react-router-dom';
import PuzzlePage, { RedirectToToday, PuzzleRedirect } from './PuzzlePage';
import WordPage from './WordPage';
import { Header } from './Header';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<RedirectToToday />} />
          <Route path="/puzzle/:date" element={<PuzzleRedirect />} />
          <Route path="/puzzle/:date/:tab" element={<PuzzlePage />} />
          <Route path="/word/:word" element={<WordPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
