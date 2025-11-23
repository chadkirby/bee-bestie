import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { ExposureConfig, OnChangeSortBy, OnToggleSortDirection } from "@/ui/types";
import { type SortKey, SORT_CONFIGS } from "@/components/WordExplorer";

interface TableControlsProps {
  // Sort props
  sortBy: SortKey;
  sortDirection: 'asc' | 'desc';
  onChangeSortBy: OnChangeSortBy;
  onToggleSortDirection: OnToggleSortDirection;

  // Masking props
  lettersToExpose: ExposureConfig;
  onLettersToExposeChange: (config: ExposureConfig) => void;
}

export function TableControls({
  sortBy,
  sortDirection,
  onChangeSortBy,
  onToggleSortDirection,
  lettersToExpose,
  onLettersToExposeChange,
}: TableControlsProps) {
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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-lg border p-3 bg-card text-card-foreground shadow-sm">
      {/* Sort Controls */}
      <div className="flex items-center gap-2">
        <select
          id="sort-by"
          className="h-8 rounded-md border bg-background px-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={sortBy}
          onChange={(event) => onChangeSortBy(event.target.value as SortKey)}
        >
          {SORT_CONFIGS.map(({ key, label }) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
          <option value="word">Word</option>
        </select>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-xs sm:text-sm"
          onClick={onToggleSortDirection}
        >
          {sortDirection === 'desc' ? '↓' : '↑'}
        </Button>
      </div>

      {/* Slider Controls */}
      <div className="flex items-center gap-4 flex-1 sm:justify-end sm:max-w-md">
        <Button
          type="button"
          variant={lettersToExpose.showAll ? "secondary" : "ghost"}
          size="sm"
          className="h-8 text-xs w-20"
          onClick={handleShowAll}
        >
          {lettersToExpose.showAll ? 'All Shown' : 'Show All'}
        </Button>

        <div className={cn("flex items-center gap-2 flex-1 min-w-[140px]", lettersToExpose.showAll && "opacity-50 pointer-events-none")}>
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
          />
          <span className="text-xs font-medium text-muted-foreground w-4 text-center">
            {maxRange - endVal}
          </span>
        </div>
      </div>
    </div>
  );
}
