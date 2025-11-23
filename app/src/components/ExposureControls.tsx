import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { ExposureConfig, OnLettersToExposeChange } from "@/ui/types";

interface ExposureControlsProps {
  lettersToExpose: ExposureConfig;
  onLettersToExposeChange: OnLettersToExposeChange;
}

export function ExposureControls({ lettersToExpose, onLettersToExposeChange }: ExposureControlsProps) {
  const { startingLetters, endingLetters, showAll } = lettersToExpose;

  const handleStartingLettersChange = (value: number) => {
    onLettersToExposeChange({
      ...lettersToExpose,
      startingLetters: Math.max(0, Math.min(10, value)),
      showAll: undefined,
    });
  };

  const handleEndingLettersChange = (value: number) => {
    onLettersToExposeChange({
      ...lettersToExpose,
      endingLetters: Math.max(0, Math.min(10, value)),
      showAll: undefined,
    });
  };

  const handleShowAll = () => {
    if (showAll) {
      // Turn off show all, reset to reasonable defaults
      onLettersToExposeChange({
        startingLetters: 0,
        endingLetters: 0,
      });
    } else {
      // Turn on show all
      onLettersToExposeChange({
        startingLetters: 0,
        endingLetters: 0,
        showAll: true,
      });
    }
  };

  const isShowAll = !!showAll;

  // Helper component for spinner controls
  const NumberSpinner = ({
    value,
    onChange,
    label,
    disabled = false
  }: {
    value: number;
    onChange: (value: number) => void;
    label: string;
    disabled?: boolean;
  }) => (
    <div className="flex items-center justify-between gap-2 rounded-md border p-1.5 shadow-sm">
      <span className="text-xs font-medium pl-1">{label}</span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onChange(value - 1)}
          disabled={disabled || value <= (label === 'Starting' ? 0 : 0)}
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </Button>
        <div className="w-4 text-center text-xs font-mono">
          {disabled ? '∞' : value}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onChange(value + 1)}
          disabled={disabled || value >= 10}
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Answer masking
        </div>
        <Button
          type="button"
          variant={isShowAll ? "secondary" : "ghost"}
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={handleShowAll}
        >
          {isShowAll ? 'All shown' : 'Show all'}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <NumberSpinner
          value={startingLetters}
          onChange={handleStartingLettersChange}
          label="Start"
          disabled={isShowAll}
        />
        <NumberSpinner
          value={endingLetters}
          onChange={handleEndingLettersChange}
          label="End"
          disabled={isShowAll}
        />
      </div>
    </div>
  );
}
