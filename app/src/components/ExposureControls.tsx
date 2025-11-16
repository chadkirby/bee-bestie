import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ExposureConfig = {
  startingLetters: number;
  endingLetters: number;
};

interface ExposureControlsProps {
  lettersToExpose: ExposureConfig;
  onLettersToExposeChange: (config: ExposureConfig) => void;
}

export function ExposureControls({ lettersToExpose, onLettersToExposeChange }: ExposureControlsProps) {
  const { startingLetters, endingLetters } = lettersToExpose;

  const handleStartingLettersChange = (value: number) => {
    onLettersToExposeChange({
      ...lettersToExpose,
      startingLetters: value,
    });
  };

  const handleEndingLettersChange = (value: number) => {
    onLettersToExposeChange({
      ...lettersToExpose,
      endingLetters: value,
    });
  };

  return (
    <div className="space-y-2 text-xs">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Answer masking
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="starting-letters">Starting letters</Label>
          <Input
            id="starting-letters"
            type="number"
            min="0"
            max="10"
            value={startingLetters}
            onChange={(e) => handleStartingLettersChange(parseInt(e.target.value) || 0)}
            className="h-8"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ending-letters">Ending letters</Label>
          <Input
            id="ending-letters"
            type="number"
            min="0"
            max="10"
            value={endingLetters}
            onChange={(e) => handleEndingLettersChange(parseInt(e.target.value) || 0)}
            className="h-8"
          />
        </div>
      </div>
    </div>
  );
}
