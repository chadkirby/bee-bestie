import { DateTime } from 'luxon';
import { type OnePuzzle } from '@lib/puzzle';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LetterGrid } from '@/components/LetterGrid';
import { ExposureControls } from '@/components/ExposureControls';
import { WordExplorer, type WordStatsRecord, type SortKey } from '@/components/WordExplorer';
import type { ExposureConfig } from './App';

interface HistoryTabProps {
  puzzle: OnePuzzle;
  lettersToExpose: ExposureConfig;
  onLettersToExposeChange: (config: ExposureConfig) => void;
  wordStats: WordStatsRecord[] | null;
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
  sortBy,
  sortDirection,
  onChangeSortBy,
  onToggleSortDirection,
}: HistoryTabProps) {
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
        {wordStats && (
          <WordExplorer
            stats={wordStats}
            lettersToExpose={lettersToExpose}
            puzzleDateIso={puzzle.printDate}
            sortBy={sortBy}
            sortDirection={sortDirection}
            onChangeSortBy={onChangeSortBy}
            onToggleSortDirection={onToggleSortDirection}
          />
        )}
      </CardContent>
    </Card>
  );
}
