import { DateTime } from 'luxon';
import { type OnePuzzle } from '@lib/puzzle';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LetterGrid } from '@/components/LetterGrid';
import { ExposureControls } from '@/components/ExposureControls';
import { WordExplorer, type WordStatsRecord, type BasicWordRecord, type WordRecord, type SortKey } from '@/components/WordExplorer';
import type { ExposureConfig } from './App';

interface HistoryTabProps {
  puzzle: OnePuzzle;
  lettersToExpose: ExposureConfig;
  onLettersToExposeChange: (config: ExposureConfig) => void;
  wordStats: WordStatsRecord[] | null;
  loadingWordStats?: boolean;
  wordStatsError?: string | null;
  sortBy: SortKey;
  sortDirection: 'asc' | 'desc';
  onChangeSortBy: (sortBy: SortKey) => void;
  onToggleSortDirection: () => void;
}


export function HistoryTab({
  puzzle,
  lettersToExpose,
  onLettersToExposeChange,
  wordStats,
  loadingWordStats = false,
  wordStatsError = null,
  sortBy,
  sortDirection,
  onChangeSortBy,
  onToggleSortDirection,
}: HistoryTabProps) {
  // Create progressive word list: basic puzzle answers enriched with stats when available
  const progressiveWordList: WordRecord[] = puzzle.answers.map(answer => {
    // Find matching word stats if available
    const wordStat = wordStats?.find(stat => stat.word.toLowerCase() === answer.toLowerCase());

    if (wordStat) {
      return wordStat; // Full stats available
    } else {
      return { word: answer, hasStats: false }; // Basic word only
    }
  });

  const hasAnyStats = progressiveWordList.some(record => 'frequency' in record);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <CardTitle className="text-base font-semibold">
              {DateTime.fromISO(puzzle.printDate).toFormat('EEEE')}, {puzzle.displayDate}
            </CardTitle>
            <div className="flex justify-center sm:justify-start">
              <div className="scale-90 sm:scale-100">
                <LetterGrid
                  centerLetter={puzzle.centerLetter.toUpperCase()}
                  outerLetters={puzzle.outerLetters.map((letter) => letter.toUpperCase())}
                />
              </div>
            </div>
          </div>
          <div className="sm:w-64">
            <ExposureControls
              lettersToExpose={lettersToExpose}
              onLettersToExposeChange={onLettersToExposeChange}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <WordExplorer
          stats={progressiveWordList}
          lettersToExpose={lettersToExpose}
          puzzleDateIso={puzzle.printDate}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onChangeSortBy={onChangeSortBy}
          onToggleSortDirection={onToggleSortDirection}
          loadingWordStats={loadingWordStats}
          wordStatsError={wordStatsError}
          hasAnyStats={hasAnyStats}
        />
      </CardContent>
    </Card>
  );
}
