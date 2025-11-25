import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { ExposureConfig } from "@/ui/types";

interface RevealControlsProps {
  lettersToExpose: ExposureConfig;
  onLettersToExposeChange: (config: ExposureConfig) => void;
  className?: string;
}

export function RevealControls({
  lettersToExpose,
  onLettersToExposeChange,
  className,
}: RevealControlsProps) {
  // Slider range: 0 to 6 (7 steps)
  // Left thumb: startingLetters (0-3)
  // Right thumb: 6 - endingLetters (3-6)

  const maxRange = 6;
  const clampThreshold = 3;

  const startVal = Math.min(lettersToExpose.startingLetters, clampThreshold);
  const endVal = Math.max(maxRange - lettersToExpose.endingLetters, clampThreshold);

  const values = [startVal, endVal];

  const handleSliderChange = (newValues: number[]) => {
    let [newStart, newEnd] = newValues;

    // Clamp values to their respective ranges
    newStart = Math.min(newStart, clampThreshold);
    newEnd = Math.max(newEnd, clampThreshold);

    // Ensure they don't cross in a way that breaks the logic (though meeting at 3 is fine)
    if (newStart > newEnd) {
      // Should not happen with the above clamping if threshold is same
      newStart = clampThreshold;
      newEnd = clampThreshold;
    }

    const newEndingLetters = maxRange - newEnd;

    onLettersToExposeChange({
      startingLetters: newStart,
      endingLetters: newEndingLetters,
      showAll: undefined,
    });
  };

  const handleShowAll = () => {
    onLettersToExposeChange({
      ...lettersToExpose,
      showAll: lettersToExpose.showAll ? undefined : true,
    });
  };

  return (
    <div className={cn("flex items-center gap-4 flex-1 sm:justify-end sm:max-w-md", className)}>
      <div className={cn("flex items-center gap-2 flex-1 min-w-[140px]", lettersToExpose.showAll && "opacity-50 pointer-events-none")}>
        <span className="text-xs font-medium text-muted-foreground shrink-0">
          Reveal:
        </span>
        <span className="text-xs font-medium text-muted-foreground w-4 text-center">
          {lettersToExpose.startingLetters}
        </span>
        <Slider
          value={values}
          min={0}
          max={maxRange}
          step={1}
          minStepsBetweenThumbs={0}
          onValueChange={handleSliderChange}
          disabled={!!lettersToExpose.showAll}
          className="flex-1"
          aria-label="Number of letters to reveal from start and end of words"
        />
        <span className="text-xs font-medium text-muted-foreground w-4 text-center">
          {maxRange - endVal}
        </span>
      </div>

      <Button
        type="button"
        variant={lettersToExpose.showAll ? "secondary" : "ghost"}
        size="sm"
        className="h-8 text-xs w-20"
        onClick={handleShowAll}
      >
        {lettersToExpose.showAll ? 'All Shown' : 'Show All'}
      </Button>
    </div>
  );
}
