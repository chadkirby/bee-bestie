import { useEffect, useState, useRef } from 'react';
import { DateTime } from 'luxon';
import { Routes, Route, Navigate, NavLink, useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { z } from 'zod/mini';
import { type OnePuzzle } from '@lib/puzzle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateNavigation } from '@/components/DateNavigation';
import { type WordStatsRecord, type SortKey } from '@/components/WordExplorer';
import { PuzzleTab } from './PuzzleTab';
import { TabDataService } from '@/services/tabDataService';
import { getBeeScore } from '@/lib/utils.ts';
import type { ExposureConfig } from './types';

// Schema for puzzle-only response
const PuzzleResponseSchema = z.object({
  puzzle: z.any(), // OnePuzzle will be validated by HistoryTab
});

const PuzzleTabNames = { words: 'words', hints: 'hints', semantics: 'semantics' } as const;

type PuzzleTab = keyof typeof PuzzleTabNames;

function makePuzzleTabUrl(date: string, tab: PuzzleTab, searchParams?: string): string {
  const baseUrl = `/puzzle/${date}/${PuzzleTabNames[tab]}`;
  return searchParams ? `${baseUrl}${searchParams}` : baseUrl;
}

function RedirectToToday() {
  const todayIso = DateTime.local().toISODate();
  if (!todayIso) return null;
  return <Navigate to={makePuzzleTabUrl(todayIso, 'words')} replace />;
}

function PuzzlePage() {
  const { date, tab: tabParam } = useParams<{ date: string; tab?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const tab: PuzzleTab =
    Object.keys(PuzzleTabNames).includes(tabParam || '')
      ? (tabParam as PuzzleTab)
      : PuzzleTabNames.words;

  const [loading, setLoading] = useState(false);
  const [loadingWordStats, setLoadingWordStats] = useState(false);
  const [puzzleData, setPuzzleData] = useState<OnePuzzle | null>(null);
  const [wordStats, setWordStats] = useState<WordStatsRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState<DateTime | null>(null);

  // Answer-masking state stored locally to avoid spoilers in shared URLs
  const [lettersToExpose, setLettersToExpose] = useState<ExposureConfig>({
    showAll: undefined,
    startingLetters: 1,
    endingLetters: 0,
  });

  // AbortController for cancelling pending words requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Derive sorting settings from URL search params so views are shareable
  const sortBy = (searchParams.get('sortBy') as SortKey) ?? 'frequency';
  const sortDirection = searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc';

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
    setLettersToExpose(config);
  };

  // Fast fetch: Puzzle data only
  const fetchPuzzle = async (isoDate: string) => {
    setLoading(true);
    setError(null);
    setPuzzleData(null);
    setWordStats(null); // Clear previous word stats

    try {
      const response = await fetch(`/puzzle/${isoDate}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const puzzleResponse = PuzzleResponseSchema.parse(await response.json());
      setPuzzleData(puzzleResponse.puzzle);
    } catch (err) {
      setError(err instanceof Error ? err.stack! : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Slow fetch: Word statistics only
  const fetchWordStats = async (isoDate: string) => {
    // Only fetch word stats for words tab
    if (tab !== 'words') return;

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Store the request date locally
    const requestDate = isoDate;

    setLoadingWordStats(true);

    try {
      const wordStatsResponse = await TabDataService.fetchWordStats(requestDate, abortController.signal);

      // Check if request was aborted during fetch
      if (abortController.signal.aborted) {
        return;
      }

      // Use the ref-based date check instead of state
      if (abortControllerRef.current?.signal && !abortControllerRef.current.signal.aborted) {
        setWordStats(wordStatsResponse.wordStats.map((stat) => ({
          ...stat,
          score: getBeeScore(stat.word),
        })));
      }
    } catch (err) {
      // Don't show error for aborted requests
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

    } finally {
      // Always update loading state on completion (unless aborted)
      if (!abortController.signal.aborted) {
        setLoadingWordStats(false);
      }
    }
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

  // When puzzle data is loaded and we're on puzzle tab, fetch word stats
  useEffect(() => {
    if (puzzleData && tab === 'words') {
      fetchWordStats(puzzleData.printDate);
    }
  }, [puzzleData, tab]);

  // Cleanup: cancel any pending requests when component unmounts
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleDateChange = (nextDate: DateTime) => {
    const nextIso = nextDate.toISODate();
    if (!nextIso) return;

    // Navigate to the same tab for the new date, preserving query params
    navigate(makePuzzleTabUrl(nextIso, tab, location.search));
  };

  if (!date) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="app">
      <div className="mx-auto max-w-4xl px-4 mt-2">
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
                to={makePuzzleTabUrl(date, 'words', location.search)}
                className={({ isActive }) =>
                  `pb-2 border-b-2 ${isActive ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground'
                  }`
                }
              >
                Words
              </NavLink>
              <NavLink
                to={makePuzzleTabUrl(date, 'hints', location.search)}
                className={({ isActive }) =>
                  `pb-2 border-b-2 ${isActive ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground'
                  }`
                }
              >
                Hints
              </NavLink>
              <NavLink
                to={makePuzzleTabUrl(date, 'semantics', location.search)}
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
          <PuzzleSkeleton />
        )}

        {puzzleData && currentDate && (
          <div className="space-y-6">
            {tab === 'words' && (
              <PuzzleTab
                puzzle={puzzleData}
                lettersToExpose={lettersToExpose}
                onLettersToExposeChange={handleLettersToExposeChange}
                wordStats={wordStats}
                loadingWordStats={loadingWordStats}
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
  return <Navigate to={makePuzzleTabUrl(date, 'words')} replace />;
}

function WordPage() {
  const { word } = useParams<{ word: string }>();
  if (!word) return null;

  return (
    <div className="app">
      <div className="mx-auto max-w-4xl px-4">
        <h1>Word: {word}</h1>
        <p>Word view coming soon.</p>
      </div>
    </div>
  );
}

function PuzzleSkeleton() {
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
