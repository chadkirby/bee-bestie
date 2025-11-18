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
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onChange(value - 1)}
          disabled={disabled || value <= (label === 'Starting' ? 0 : 0)}
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </Button>
        <div className="w-8 text-center text-sm font-mono">
          {disabled ? '∞' : value}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
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
    <div className="space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Answer masking
        </div>
        <Button
          type="button"
          variant={isShowAll ? "default" : "outline"}
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={handleShowAll}
        >
          {isShowAll ? 'All shown' : 'Show all'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NumberSpinner
          value={startingLetters}
          onChange={handleStartingLettersChange}
          label="Starting"
          disabled={isShowAll}
        />
        <NumberSpinner
          value={endingLetters}
          onChange={handleEndingLettersChange}
          label="Ending"
          disabled={isShowAll}
        />
      </div>
    </div>
  );
}
