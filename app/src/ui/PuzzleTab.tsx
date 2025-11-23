import { DateTime } from 'luxon';
import { type OnePuzzle } from '@lib/puzzle';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LetterGrid } from '@/components/LetterGrid';
import { ExposureControls } from '@/components/ExposureControls';
import { WordExplorer, type WordStatsRecord, type BasicWordRecord, type WordRecord, type SortKey } from '@/components/WordExplorer';
import type { ExposureConfig, OnLettersToExposeChange, OnChangeSortBy, OnToggleSortDirection } from './types';
import { getBeeScore } from '@/lib/utils.ts';
import { Badge } from '@/components/ui/badge';
import { Teletype } from '@/components/Teletype';

interface PuzzleTabProps {
  puzzle: OnePuzzle;
  lettersToExpose: ExposureConfig;
  onLettersToExposeChange: OnLettersToExposeChange;
  wordStats: WordStatsRecord[] | null;
  loadingWordStats?: boolean;
  sortBy: SortKey;
  sortDirection: 'asc' | 'desc';
  onChangeSortBy: OnChangeSortBy;
  onToggleSortDirection: OnToggleSortDirection;
}

function ScoringSummary({ totalPoints }: { totalPoints: number }) {
  const geniusThreshold = Math.floor(totalPoints * 0.7);

  return (
    <div className="text-center space-y-2">
      <div className="text-2xl font-bold text-primary">{totalPoints.toLocaleString()}</div>
      <div className="text-sm text-muted-foreground">Total Points</div>
      <div className="flex items-center justify-center gap-2">
        <Badge variant="secondary" className="text-xs">
          Genius: {geniusThreshold.toLocaleString()}
        </Badge>
      </div>
    </div>
  );
}


export function PuzzleTab({
  puzzle,
  lettersToExpose,
  onLettersToExposeChange,
  wordStats,
  loadingWordStats = false,
  sortBy,
  sortDirection,
  onChangeSortBy,
  onToggleSortDirection,
}: PuzzleTabProps) {
  // Create progressive word list: basic puzzle answers enriched with stats when available
  const progressiveWordList: WordRecord[] = puzzle.answers.map(answer => {
    // Find matching word stats if available
    const wordStat = wordStats?.find(stat => stat.word.toLowerCase() === answer.toLowerCase());

    if (wordStat) {
      return wordStat; // Full stats available
    } else {
      return { word: answer, score: getBeeScore(answer), hasStats: false }; // Basic word only
    }
  });

  // Calculate total points from all answers
  const totalPoints = puzzle.answers.reduce((sum, answer) => sum + getBeeScore(answer), 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <CardTitle className="text-base font-semibold">
              {DateTime.fromISO(puzzle.printDate).toFormat('EEEE')}, {puzzle.displayDate}
            </CardTitle>
            <div className="flex items-center justify-center gap-6 sm:justify-start">
              <div className="scale-90 sm:scale-100">
                <LetterGrid
                  centerLetter={puzzle.centerLetter.toUpperCase()}
                  outerLetters={puzzle.outerLetters.map((letter) => letter.toUpperCase())}
                />
              </div>
              <div className="flex flex-col items-center">
                <ScoringSummary totalPoints={totalPoints} />
              </div>
              <div className="mb-6">
                <Teletype
                  center={puzzle.centerLetter}
                  outer={puzzle.outerLetters.join('')}
                  forbiddenWords={puzzle.answers}
                  className="w-64 mx-auto"
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
        />
      </CardContent>
    </Card>
  );
}
