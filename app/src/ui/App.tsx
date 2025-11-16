import { useState, useEffect } from 'react';
import { DateTime } from 'luxon';
import { type OnePuzzle } from '@lib/puzzle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnswerItem } from '@/components/AnswerItem';
import { ExposureControls } from '@/components/ExposureControls';
import { LetterGrid } from '@/components/LetterGrid';
import { DateNavigation } from '@/components/DateNavigation';
import { WordExplorer, type WordStatsRecord } from '@/components/WordExplorer';
import { DateResponseSchema } from '@/lib/load-data.ts';

type ExposureConfig = {
  startingLetters: number;
  endingLetters: number;
};

export default function App() {
  const [loading, setLoading] = useState(false);
  const [puzzleData, setPuzzleData] = useState<OnePuzzle | null>(null);
  const [wordStats, setWordStats] = useState<WordStatsRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lettersToExpose, setLettersToExpose] = useState<ExposureConfig>({
    startingLetters: 0,
    endingLetters: 0,
  });
  const [currentDate, setCurrentDate] = useState<DateTime | null>(null);

  // Parse date from URL or default to today
  const getDateFromUrl = (): DateTime => {
    const urlParams = new URLSearchParams(window.location.search);
    const dateParam = urlParams.get('date');

    if (dateParam) {
      return DateTime.fromISO(dateParam);
    }

    return DateTime.local().startOf('day');
  };

  // Update URL with the current date
  const updateUrl = (date: DateTime) => {
    const url = new URL(window.location.href);
    url.searchParams.set('date', date.toISODate()!);
    window.history.pushState({}, '', url.toString());
  };

  // Handle date changes
  const handleDateChange = (date: DateTime) => {
    setCurrentDate(date);
    updateUrl(date);
    fetchByDate(date);
  };

  const fetchByDate = async (date: DateTime) => {
    setLoading(true);
    setError(null);
    setPuzzleData(null);
    setWordStats(null);

    try {
      const yyyyMMdd = date.toFormat('yyyy-MM-dd');
      const response = await fetch(`/date?date=${yyyyMMdd}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const responseData = DateResponseSchema.parse(await response.json());
      const puzzle = responseData.puzzle;
      const stats = responseData.wordStats;
      console.log('Game data for', date.toISODate(), puzzle);
      console.log('Word stats:', stats);
      setPuzzleData(puzzle);
      setWordStats(stats);
    } catch (err) {
      setError(err instanceof Error ? err.stack! : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Initialize with date from URL or default to today
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const originalDateParam = urlParams.get('date');

    // If no date in URL, redirect to today's date
    if (!originalDateParam) {
      const today = DateTime.local().startOf('day');
      updateUrl(today);
    }

    const urlDate = getDateFromUrl();
    setCurrentDate(urlDate);
    fetchByDate(urlDate);
  }, []);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const urlDate = getDateFromUrl();
      setCurrentDate(urlDate);
      fetchByDate(urlDate);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <div className="app">
      <div className="mx-auto max-w-3xl px-4">
        <h1>NYT Spelling Bee</h1>

        {loading && (
          <div className="loading">
            <span className="loader" />
            <p>Loading today's puzzle...</p>
          </div>
        )}

        {puzzleData && currentDate && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="text-center">
                  <CardTitle className="mb-4">
                    {DateTime.fromISO(puzzleData.printDate).toFormat('EEEE')}, {puzzleData.displayDate}
                  </CardTitle>
                  <DateNavigation
                    currentDate={currentDate}
                    onDateChange={handleDateChange}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <LetterGrid
                  centerLetter={puzzleData.centerLetter.toUpperCase()}
                  outerLetters={puzzleData.outerLetters.map(letter => letter.toUpperCase())}
                />
              </CardContent>
            </Card>

            <ExposureControls
              lettersToExpose={lettersToExpose}
              onLettersToExposeChange={setLettersToExpose}
            />

            {wordStats && (
              <Card>
                <CardHeader>
                  <CardTitle>Word Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <WordExplorer
                    stats={wordStats}
                    lettersToExpose={lettersToExpose}
                    puzzleDateIso={puzzleData.printDate}
                  />
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
