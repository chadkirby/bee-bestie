import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GalaxyPlot } from '@/components/galaxy/GalaxyPlot';
import { useGalaxyData } from '@/components/galaxy/useGalaxyData';
import { OnePuzzle } from '@lib/puzzle';
import { PhonotacticScorer } from '@lib/word-freqs/phonotactic';
import { LetterGrid } from '@/components/LetterGrid';

interface GalaxyTabProps {
  puzzle: OnePuzzle;
  scorer: PhonotacticScorer | null;
}

export function GalaxyTab({ puzzle, scorer }: GalaxyTabProps) {
  const { points, loading, sortedLetters } = useGalaxyData({
    centerLetter: puzzle.centerLetter,
    outerLetters: puzzle.outerLetters,
    answers: puzzle.answers,
    scorer
  });

  return (
    <Card className="h-[900px] flex flex-col">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>BeeDar</CardTitle>
          <div className="flex items-center gap-4">

            <div className="scale-75 sm:scale-90 origin-center sm:origin-right">
              <LetterGrid
                centerLetter={puzzle.centerLetter.toUpperCase()}
                outerLetters={puzzle.outerLetters.map((letter) => letter.toUpperCase())}
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}
        <GalaxyPlot
          data={points}
          sortedLetters={sortedLetters}
          className="w-full h-full"
        />
      </CardContent>
    </Card>
  );
}
