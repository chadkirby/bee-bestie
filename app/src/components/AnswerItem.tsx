import { Badge } from "@/components/ui/badge";
import type { ExposureConfig } from "@/ui/types";

interface AnswerDisplayProps {
  answer: string;
  lettersToExpose: ExposureConfig;
  isPangram?: boolean;
}

export function AnswerItem({ answer, lettersToExpose }: AnswerDisplayProps) {
  const { startingLetters, endingLetters, showAll } = lettersToExpose;
  let displayString = answer;

  // If showAll is true, display the full word
  if (!showAll && (Number.isFinite(startingLetters) || Number.isFinite(endingLetters))) {

    let adjustedStarting = startingLetters;
    let adjustedEnding = endingLetters;

    const maxCharsToExpose = answer.length / 2;
    if (startingLetters + endingLetters > maxCharsToExpose && !(!Number.isFinite(startingLetters))) {
      // adjust starting and ending Letters proportionally to not exceed half the word length
      const scale = maxCharsToExpose / (startingLetters + endingLetters);
      adjustedStarting = Math.floor(startingLetters * scale);
      adjustedEnding = Math.floor(endingLetters * scale);
    }

    const totalExposed = adjustedStarting + adjustedEnding;

    // Calculate masked part
    const maskedLength = Math.max(0, answer.length - totalExposed);
    displayString =
      `${answer.slice(0, adjustedStarting)}${'*'.repeat(maskedLength)}${(adjustedEnding > 0 ? answer.slice(-adjustedEnding) : '')}`;
  }

  // const isPangram = new Set(answer.split('')).size >= 7;
  return (
    <div className="text-sm font-mono">
      {displayString}
    </div>
  );
}
