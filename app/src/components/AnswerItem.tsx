import type { ExposureConfig } from "@/ui/types";

interface AnswerDisplayProps {
  answer: string;
  lettersToExpose: ExposureConfig;
  isPangram?: boolean;
}

export function AnswerItem({ answer, lettersToExpose, }: AnswerDisplayProps) {
  const { startingLetters, endingLetters, showAll } = lettersToExpose;
  let displayString = answer;

  // If showAll is true, display the full word
  if (!showAll && (startingLetters + endingLetters < answer.length)) {
    const totalExposed = startingLetters + endingLetters;

    // Calculate masked part
    const maskedLength = Math.max(0, answer.length - totalExposed);
    displayString =
      `${answer.slice(0, startingLetters)}${'*'.repeat(maskedLength)}${(endingLetters > 0 ? answer.slice(-endingLetters) : '')} (${answer.length})`;
  }

  // const isPangram = new Set(answer.split('')).size >= 7;
  return (
    <div className="text-sm font-mono">
      {displayString}
    </div>
  );
}
