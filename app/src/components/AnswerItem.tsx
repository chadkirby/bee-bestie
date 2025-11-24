import { NavLink, useLocation } from 'react-router-dom';
import type { ExposureConfig } from "@/ui/types";

interface AnswerDisplayProps {
  answer: string;
  lettersToExpose: ExposureConfig;
  isPangram?: boolean;
}

export function AnswerItem({ answer, lettersToExpose, }: AnswerDisplayProps) {
  const location = useLocation();
  const { startingLetters, endingLetters, showAll } = lettersToExpose;
  let displayString = answer;

  // If showAll is true, display the full word
  if (!showAll && (startingLetters + endingLetters < answer.length)) {
    const totalExposed = startingLetters + endingLetters;

    // Calculate masked part
    const maskedLength = Math.max(0, answer.length - totalExposed);
    displayString =
      `${answer.slice(0, startingLetters)}${'*'.repeat(maskedLength)}${(endingLetters > 0 ? answer.slice(-endingLetters) : '')}`;
  }

  // Extract puzzle date from current location for back navigation
  const puzzleDate = location.pathname.match(/\/puzzle\/([^/]+)/)?.[1];

  return showAll ? (
    <NavLink
      to={`/word/${answer.toLowerCase()}`}
      state={{ fromPuzzle: puzzleDate }}
      className="text-sm font-mono hover:text-blue-600 hover:underline transition-colors"
    >
      {displayString}
    </NavLink>
  ) : (
    <span className="text-sm font-mono">{displayString}</span>
  );
}
