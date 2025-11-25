import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GalaxyPlot } from '@/components/galaxy/GalaxyPlot';
import { useGalaxyData } from '@/components/galaxy/useGalaxyData';
import { OnePuzzle } from '@lib/puzzle';
import { PhonotacticScorer } from '@lib/word-freqs/phonotactic';
import { LetterGrid } from '@/components/LetterGrid';
import { useSearchParams } from 'react-router-dom';
import { useCallback } from 'react';
import type { ExposureConfig, OnLettersToExposeChange } from './types';
import { RevealControls } from '@/components/RevealControls';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

interface GalaxyTabProps {
  puzzle: OnePuzzle;
  scorer: PhonotacticScorer | null;
  lettersToExpose: ExposureConfig;
  onLettersToExposeChange: OnLettersToExposeChange;
}

export function GalaxyTab({
  puzzle,
  scorer,
  lettersToExpose,
  onLettersToExposeChange
}: GalaxyTabProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Default to true if not specified
  const showExiles = searchParams.get('exiles') !== 'false';

  const handleToggleExiles = useCallback((checked: boolean) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (checked) {
        newParams.delete('exiles'); // Default is true, so remove param to keep URL clean
      } else {
        newParams.set('exiles', 'false');
      }
      return newParams;
    }, { replace: true });
  }, [setSearchParams]);

  const { points, loading, sortedLetters } = useGalaxyData({
    centerLetter: puzzle.centerLetter,
    outerLetters: puzzle.outerLetters,
    answers: puzzle.answers,
    scorer
  });

  return (
    <Card className="h-[620px] md:h-[900px] flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Title - Order 1 */}
          <CardTitle className="order-1">BeeDar</CardTitle>

          {/* LetterGrid - Order 2 on mobile (right of title), Order 3 on desktop (far right) */}
          <div className="order-2 md:order-3 scale-75 md:scale-90 origin-right">
            <LetterGrid
              centerLetter={puzzle.centerLetter.toUpperCase()}
              outerLetters={puzzle.outerLetters.map((letter) => letter.toUpperCase())}
            />
          </div>

          {/* Controls - Order 3 on mobile (new row), Order 2 on desktop (middle) */}
          <div className="order-3 md:order-2 w-full md:w-auto md:flex-1 flex flex-col sm:flex-row items-center justify-center gap-4 md:gap-8">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-exiles"
                checked={showExiles}
                onCheckedChange={(checked) => handleToggleExiles(checked === true)}
              />
              <Label htmlFor="show-exiles" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Show Exiles
              </Label>
            </div>

            <RevealControls
              lettersToExpose={lettersToExpose}
              onLettersToExposeChange={onLettersToExposeChange}
              className="w-full sm:w-auto sm:justify-center sm:max-w-xs md:max-w-md"
            />
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
          showExiles={showExiles}
          lettersToExpose={lettersToExpose}
        />
      </CardContent>
    </Card>
  );
}
