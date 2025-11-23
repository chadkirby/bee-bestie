import { useEffect, useState, useRef, useMemo } from 'react';
import { DateTime } from 'luxon';
import { useParams, useNavigate, useLocation, useSearchParams, NavLink, Navigate } from 'react-router-dom';
import { z } from 'zod/mini';
import { type OnePuzzle } from '@lib/puzzle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateNavigation } from '@/components/DateNavigation';
import { type WordStatsRecord, type SortKey } from '@/components/WordExplorer';
import { PuzzleTab } from './PuzzleTab';
import { TabDataService } from '@/services/tabDataService';
import { getBeeScore } from '@/lib/utils.ts';
import type { ExposureConfig } from './types';
import { hc } from 'hono/client';
import type { AppType } from '../worker/index';

const client = hc<AppType>('/');

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

function getLatestAvailableDate(): DateTime {
  // Puzzle releases at 3:00 AM ET, but worker runs at 3:01-3:03 AM ET.
  // We use 3:05 AM as the "available" time to be safe.
  return DateTime.now().setZone('America/New_York').minus({ hours: 3, minutes: 5 }).startOf('day');
}

export function RedirectToToday() {
  const latestIso = getLatestAvailableDate().toISODate();
  if (!latestIso) return null;
  return <Navigate to={makePuzzleTabUrl(latestIso, 'words')} replace />;
}

function PuzzleNotFound({ date }: { date: DateTime }) {
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  // Construct the release time strictly based on the date string in NY timezone
  const isoDate = date.toISODate();
  const releaseTime = useMemo(() => {
    if (!isoDate) return null;
    return DateTime.fromISO(isoDate, { zone: 'America/New_York' })
      .set({ hour: 3, minute: 5, second: 0, millisecond: 0 });
  }, [isoDate]);

  useEffect(() => {
    if (!releaseTime) return;

    const now = DateTime.now().setZone('America/New_York');

    if (now < releaseTime) {
      const updateTimer = () => {
        const now = DateTime.now().setZone('America/New_York');
        const diff = releaseTime.diff(now, ['hours', 'minutes', 'seconds']);
        if (diff.as('milliseconds') > 0) {
          setTimeLeft(diff.toFormat("h'h' m'm' s's'"));
        } else {
          setTimeLeft(null);
          // Refresh page when time is up
          window.location.reload();
        }
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [releaseTime]);

  const isFuture = date > getLatestAvailableDate();

  return (
    <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/20">
      <CardHeader>
        <CardTitle className="text-orange-800 dark:text-orange-200">
          Puzzle Not Found
        </CardTitle>
      </CardHeader>
      <CardContent className="text-orange-700 dark:text-orange-300">
        <p className="mb-4">
          We couldn't find a puzzle for {date.toLocaleString(DateTime.DATE_FULL)}.
        </p>

        {isFuture && timeLeft && releaseTime ? (
          <div className="mb-4">
            <p className="font-semibold">This puzzle hasn't been released yet!</p>
            <p className="text-sm text-muted-foreground mt-1 mb-2">
              Expected release: 3:05 AM ET ({releaseTime.toLocal().toLocaleString(DateTime.TIME_SIMPLE)} your time)
            </p>
            <p>It will be available in approximately:</p>
            <p className="text-2xl font-bold mt-2 font-mono">{timeLeft}</p>
          </div>
        ) : (
          <p>
            It might be from the future, or we just haven't gotten around to it yet.
          </p>
        )}

        <div className="mt-6">
          <NavLink
            to="/"
            className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          >
            Go to Today's Puzzle
          </NavLink>
        </div>
      </CardContent>
    </Card>
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

export default function PuzzlePage() {
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
  const [error, setError] = useState<{ type: 'NOT_FOUND' | 'GENERIC'; message: string } | null>(null);
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

  // Fast fetch: Puzzle data only
  const fetchPuzzle = async (isoDate: string) => {
    setLoading(true);
    setError(null);
    setPuzzleData(null);
    setWordStats(null); // Clear previous word stats

    try {
      const response = await client.puzzle[':date'].$get({
        param: { date: isoDate },
      });
      if (!response.ok) {
        if (response.status === 404) {
          setError({ type: 'NOT_FOUND', message: 'Puzzle not found' });
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const puzzleResponse = PuzzleResponseSchema.parse(await response.json());
      setPuzzleData(puzzleResponse.puzzle);
    } catch (err) {
      setError({ type: 'GENERIC', message: err instanceof Error ? err.message : 'An error occurred' });
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
      if (!dateTime.isValid) {
        setError({ type: 'GENERIC', message: 'Invalid date' });
        return;
      }
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
                  latestAvailableDate={getLatestAvailableDate()}
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
              <>
                <PuzzleTab
                  puzzle={puzzleData}
                  lettersToExpose={lettersToExpose}
                  onLettersToExposeChange={setLettersToExpose}
                  wordStats={wordStats}
                  loadingWordStats={loadingWordStats}
                  sortBy={sortBy}
                  sortDirection={sortDirection}
                  onChangeSortBy={handleChangeSortBy}
                  onToggleSortDirection={handleToggleSortDirection}
                />
              </>
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
          <div className="mt-8">
            {error.type === 'NOT_FOUND' ? (
              <PuzzleNotFound date={currentDate || DateTime.now()} />
            ) : (
              <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20">
                <CardHeader>
                  <CardTitle className="text-red-800 dark:text-red-200">
                    Something went wrong
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-red-700 dark:text-red-300">
                  <p>{error.message}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function PuzzleRedirect() {
  const { date } = useParams<{ date: string }>();
  if (!date) {
    return <RedirectToToday />;
  }
  return <Navigate to={makePuzzleTabUrl(date, 'words')} replace />;
}
