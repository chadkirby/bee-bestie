import { Button } from "@/components/ui/button";
import { RevealControls } from "./RevealControls";
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


  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-lg border p-3 bg-card text-card-foreground shadow-sm">
      {/* Sort Controls */}
      <div className="flex items-center gap-2">
        <label htmlFor="sort-by" className="text-xs sm:text-sm font-medium text-muted-foreground">
          Sort by:
        </label>
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
          aria-label={`Sort ${sortDirection === 'desc' ? 'descending' : 'ascending'}`}
        >
          {sortDirection === 'desc' ? '↓' : '↑'}
        </Button>
      </div>

      {/* Slider Controls */}
      <RevealControls
        lettersToExpose={lettersToExpose}
        onLettersToExposeChange={onLettersToExposeChange}
      />
    </div>
  );
}
