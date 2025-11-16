import { useEffect, useState } from 'react';
import { DateTime } from 'luxon';
import { Routes, Route, Navigate, NavLink, useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { z } from 'zod/mini';
import { type OnePuzzle } from '@lib/puzzle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateNavigation } from '@/components/DateNavigation';
import { WordExplorer, type WordStatsRecord, type SortKey } from '@/components/WordExplorer';
import { HistoryTab } from './HistoryTab';

// Schema for puzzle-only response
const PuzzleResponseSchema = z.object({
  puzzle: z.any(), // OnePuzzle will be validated by HistoryTab
});

// Schema for word-stats response
const WordStatsResponseSchema = z.object({
  wordStats: z.array(z.object({
    word: z.string(),
    found: z.boolean(),
    frequency: z.number(),
    commonality: z.number(),
    probability: z.number(),
    sbHistory: z.array(z.string()),
  })),
});

export type ExposureConfig = {
  startingLetters: number;
  endingLetters: number;
};

type PuzzleTab = 'history' | 'hints' | 'semantics';

function RedirectToToday() {
  const todayIso = DateTime.local().toISODate();
  if (!todayIso) return null;
  return <Navigate to={`/puzzle/${todayIso}/history`} replace />;
}

function PuzzlePage() {
  const { date, tab: tabParam } = useParams<{ date: string; tab?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const tab: PuzzleTab =
    tabParam === 'hints' || tabParam === 'semantics' || tabParam === 'history'
      ? (tabParam as PuzzleTab)
      : 'history';

  const [loading, setLoading] = useState(false);
  const [loadingWordStats, setLoadingWordStats] = useState(false);
  const [puzzleData, setPuzzleData] = useState<OnePuzzle | null>(null);
  const [wordStats, setWordStats] = useState<WordStatsRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wordStatsError, setWordStatsError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState<DateTime | null>(null);

  // Derive sort + exposure settings from URL search params so views are shareable
  const sortBy = (searchParams.get('sortBy') as SortKey) ?? 'frequency';
  const sortDirection = searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc';

  const startParam = Number(searchParams.get('start') ?? '0');
  const endParam = Number(searchParams.get('end') ?? '0');
  const lettersToExpose: ExposureConfig = {
    startingLetters: Number.isNaN(startParam) ? 0 : startParam,
    endingLetters: Number.isNaN(endParam) ? 0 : endParam,
  };

  const handleChangeSortBy = (nextSortBy: SortKey) => {
    const next = new URLSearchParams(searchParams);
    next.set('sortBy', nextSortBy);
    setSearchParams(next);
  };

  const handleToggleSortDirection = () => {
    const next = new URLSearchParams(searchParams);
    const current = next.get('sortDir') === 'asc' ? 'asc' : 'desc';
    next.set('sortDir', current === 'desc' ? 'asc' : 'desc');
    setSearchParams(next);
  };

  const handleLettersToExposeChange = (config: ExposureConfig) => {
    const next = new URLSearchParams(searchParams);
    next.set('start', String(config.startingLetters));
    next.set('end', String(config.endingLetters));
    setSearchParams(next);
  };

  // Fast fetch: Puzzle data only
  const fetchPuzzle = async (isoDate: string) => {
    setLoading(true);
    setError(null);
    setPuzzleData(null);
    setWordStatsError(null); // Clear word stats error on new puzzle

    try {
      const response = await fetch(`/puzzle/${isoDate}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const puzzleResponse = PuzzleResponseSchema.parse(await response.json());
      console.log('Puzzle data for', isoDate, puzzleResponse);
      setPuzzleData(puzzleResponse.puzzle);
    } catch (err) {
      setError(err instanceof Error ? err.stack! : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Slow fetch: Word statistics only
  const fetchWordStats = async (isoDate: string) => {
    // Only fetch word stats for history tab
    if (tab !== 'history') return;

    setLoadingWordStats(true);
    setWordStatsError(null);

    try {
      const response = await fetch(`/puzzle/${isoDate}/word-stats`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const wordStatsResponse = WordStatsResponseSchema.parse(await response.json());
      console.log('Word stats for', isoDate, wordStatsResponse);
      setWordStats(wordStatsResponse.wordStats);
    } catch (err) {
      setWordStatsError(err instanceof Error ? err.stack! : 'An error occurred');
    } finally {
      setLoadingWordStats(false);
    }
  };

  // Legacy fetch function for backward compatibility
  const fetchByDate = async (isoDate: string) => {
    await fetchPuzzle(isoDate);
    await fetchWordStats(isoDate);
  };

  // When the route date changes, update state and fetch puzzle data immediately
  useEffect(() => {
    if (!date) return;
    const dateTime = DateTime.fromISO(date).startOf('day');
    if (!dateTime.isValid) {
      setError('Invalid date');
      return;
    }
    setCurrentDate(dateTime);
    fetchPuzzle(dateTime.toISODate()!);
  }, [date]);

  // When tab changes to history or date changes, fetch word stats
  useEffect(() => {
    if (!date || !currentDate) return;
    if (tab === 'history') {
      fetchWordStats(currentDate.toISODate()!);
    }
  }, [date, tab, currentDate]);

  const handleDateChange = (nextDate: DateTime) => {
    const nextIso = nextDate.toISODate();
    if (!nextIso) return;

    // Navigate to the same tab for the new date, preserving query params
    const search = location.search ?? '';
    navigate(`/puzzle/${nextIso}/${tab}${search}`);
  };

  if (!date) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="app">
      <div className="mx-auto max-w-3xl px-4 mt-2">
        <h1 className="text-3xl font-bold">Bee Bestie</h1>

        <div className="mt-4 mb-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Puzzle date
              </span>
              {currentDate && (
                <DateNavigation
                  currentDate={currentDate}
                  onDateChange={handleDateChange}
                />
              )}
            </div>

            <nav className="flex gap-4 text-sm">
              <NavLink
                to={`/puzzle/${date}/history${location.search ?? ''}`}
                className={({ isActive }) =>
                  `pb-2 border-b-2 ${isActive ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground'
                  }`
                }
              >
                History
              </NavLink>
              <NavLink
                to={`/puzzle/${date}/hints${location.search ?? ''}`}
                className={({ isActive }) =>
                  `pb-2 border-b-2 ${isActive ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground'
                  }`
                }
              >
                Hints
              </NavLink>
              <NavLink
                to={`/puzzle/${date}/semantics${location.search ?? ''}`}
                className={({ isActive }) =>
                  `pb-2 border-b-2 ${isActive ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground'
                  }`
                }
              >
                Semantics
              </NavLink>
            </nav>
          </div>
        </div>

        {loading && !puzzleData && (
          <HistorySkeleton />
        )}

        {puzzleData && currentDate && (
          <div className="space-y-6">
            {tab === 'history' && (
              <HistoryTab
                puzzle={puzzleData}
                lettersToExpose={lettersToExpose}
                onLettersToExposeChange={handleLettersToExposeChange}
                wordStats={wordStats}
                loadingWordStats={loadingWordStats}
                wordStatsError={wordStatsError}
                sortBy={sortBy}
                sortDirection={sortDirection}
                onChangeSortBy={handleChangeSortBy}
                onToggleSortDirection={handleToggleSortDirection}
              />
            )}

            {tab === 'hints' && !error && (
              <Card>
                <CardHeader>
                  <CardTitle>Hints</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>Hints view coming soon.</p>
                </CardContent>
              </Card>
            )}

            {tab === 'semantics' && !error && (
              <Card>
                <CardHeader>
                  <CardTitle>Word Semantics</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>Word semantics view coming soon.</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {error && (
          <div className="error">
            <h2>Something went wrong</h2>
            <p>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PuzzleRedirect() {
  const { date } = useParams<{ date: string }>();
  if (!date) {
    return <Navigate to="/" replace />;
  }
  return <Navigate to={`/puzzle/${date}/history`} replace />;
}

function WordPage() {
  const { word } = useParams<{ word: string }>();
  if (!word) return null;

  return (
    <div className="app">
      <div className="mx-auto max-w-3xl px-4">
        <h1>Word: {word}</h1>
        <p>Word view coming soon.</p>
      </div>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <Card>
        <CardHeader>
          <div className="h-6 w-48 rounded bg-muted" />
          <div className="mt-4 flex justify-center">
            <div className="h-8 w-40 rounded bg-muted" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-24 rounded bg-muted" />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="h-16 rounded bg-muted" />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="space-y-2">
            <div className="h-6 rounded bg-muted" />
            <div className="h-6 rounded bg-muted" />
            <div className="h-6 rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

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
