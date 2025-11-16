import { Card, CardContent } from "@/components/ui/card";
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
    <Card className="py-3">
      <CardContent className="px-4 py-2">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Answer masking
        </div>
        <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="starting-letters">Starting letters</Label>
            <Input
              id="starting-letters"
              type="number"
              min="0"
              max="10"
              value={startingLetters}
              onChange={(e) => handleStartingLettersChange(parseInt(e.target.value) || 0)}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ending-letters">Ending letters</Label>
            <Input
              id="ending-letters"
              type="number"
              min="0"
              max="10"
              value={endingLetters}
              onChange={(e) => handleEndingLettersChange(parseInt(e.target.value) || 0)}
              className="w-full"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
