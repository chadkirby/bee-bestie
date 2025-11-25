import { DateTime } from 'luxon';
import { type OnePuzzle } from '@lib/puzzle';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LetterGrid } from '@/components/LetterGrid';
import { TableControls } from '@/components/TableControls';
import { WordExplorer, type WordStatsRecord, type WordRecord, type SortKey } from '@/components/WordExplorer';
import type { ExposureConfig, OnLettersToExposeChange, OnChangeSortBy, OnToggleSortDirection } from './types';
import { getBeeScore } from '@/lib/utils.ts';
import { Badge } from '@/components/ui/badge';
import { Teletype } from '@/components/Teletype';
import { PhonotacticScorer } from '@lib/word-freqs/phonotactic';

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
  scorer: PhonotacticScorer | null;
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
  scorer,
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
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          {/* Left Column: Puzzle Info */}
          <div className="flex flex-col gap-6 flex-1">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-start sm:gap-8">
              {/* Grid and Score Group */}
              <div className="flex items-center gap-6">
                <div className="scale-90 sm:scale-100">
                  <LetterGrid
                    centerLetter={puzzle.centerLetter.toUpperCase()}
                    outerLetters={puzzle.outerLetters.map((letter) => letter.toUpperCase())}
                  />
                </div>
                <div className="flex flex-col items-center justify-center pt-2">
                  <ScoringSummary totalPoints={totalPoints} />
                </div>
              </div>

              {/* Teletype - Centered on mobile, left-aligned on desktop if space permits */}
              <div className="w-full max-w-[280px] sm:w-auto sm:max-w-none sm:pt-4">
                <Teletype
                  center={puzzle.centerLetter}
                  outer={puzzle.outerLetters.join('')}
                  forbiddenWords={puzzle.answers}
                  scorer={scorer}
                  // needs a fixed with so the play/pause button doesn't move as the text changes
                  className="w-40 mx-auto"
                />
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <TableControls
          sortBy={sortBy}
          sortDirection={sortDirection}
          onChangeSortBy={onChangeSortBy}
          onToggleSortDirection={onToggleSortDirection}
          lettersToExpose={lettersToExpose}
          onLettersToExposeChange={onLettersToExposeChange}
        />
        <WordExplorer
          stats={progressiveWordList}
          lettersToExpose={lettersToExpose}
          puzzleDateIso={puzzle.printDate}
          sortBy={sortBy}
          sortDirection={sortDirection}
          loadingWordStats={loadingWordStats}
        />
      </CardContent>
    </Card>
  );
}
