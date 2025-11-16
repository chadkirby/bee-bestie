import { Badge } from "@/components/ui/badge";

type ExposureConfig = {
  startingLetters: number;
  endingLetters: number;
};

interface AnswerDisplayProps {
  answer: string;
  lettersToExpose: ExposureConfig;
  isPangram?: boolean;
}

export function AnswerItem({ answer, lettersToExpose }: AnswerDisplayProps) {
  const { startingLetters, endingLetters } = lettersToExpose;
  const totalExposed = startingLetters + endingLetters;
  const isPangram = new Set(answer.split('')).size >= 7;

  // If total exposed letters >= answer length, show full answer
  if (totalExposed >= answer.length) {
    return (
      <Badge variant={isPangram ? "default" : "secondary"} className="text-sm font-mono">
        {answer}
      </Badge>
    );
  }

  // Calculate masked part
  const maskedLength = Math.max(0, answer.length - totalExposed);
  const displayString =
    `${answer.slice(0, startingLetters)}${'*'.repeat(maskedLength)}${(endingLetters > 0 ? answer.slice(-endingLetters) : '')}`;

  return (
    <Badge variant={isPangram ? "default" : "outline"} className="text-sm font-mono">
      {displayString}
    </Badge>
  );
}
