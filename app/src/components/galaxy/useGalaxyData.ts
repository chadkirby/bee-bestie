import { useState, useEffect, useMemo } from 'react';
import { PhonotacticScorer } from '@lib/word-freqs/phonotactic';
import { TabDataService } from '@/services/tabDataService';
import { GalaxyPoint } from './types';

interface UseGalaxyDataProps {
  centerLetter: string;
  outerLetters: string[];
  answers: string[];
  scorer: PhonotacticScorer | null;
}

export const useGalaxyData = ({ centerLetter, outerLetters, answers, scorer }: UseGalaxyDataProps) => {
  const [points, setPoints] = useState<GalaxyPoint[]>([]);
  const [loading, setLoading] = useState(false);

  const pool = useMemo(() => centerLetter + outerLetters.join(''), [centerLetter, outerLetters]);
  const sortedLetters = useMemo(() => [centerLetter, ...outerLetters].sort(), [centerLetter, outerLetters]);

  useEffect(() => {
    if (!scorer) return;

    let mounted = true;
    setLoading(true);

    const generateData = async () => {
      try {
        // 1. Fetch Exiles (Valid words not in answers)
        const exilesResponse = (await TabDataService.fetchExiles(
          pool,
          centerLetter
        )) as { words: string[] };
        const answerSet = new Set(answers);

        const exiles = exilesResponse.words.filter(
          (w: string) => !answerSet.has(w)
        );

        // 3. Combine and Score
        const newPoints: GalaxyPoint[] = [];

        // Helper to create point
        const createPoint = (
          word: string,
          type: GalaxyPoint['type']
        ): GalaxyPoint => {
          const firstLetter = word[0].toLowerCase();
          const sliceIndex = sortedLetters.indexOf(firstLetter);

          return {
            id: `${type}-${word}`,
            word,
            type,
            sliceIndex: sliceIndex === -1 ? 0 : sliceIndex, // Fallback, shouldn't happen
            length: word.length,
            score: scorer.score(word),
          };
        };

        // Add Answers
        answers.forEach((w) => newPoints.push(createPoint(w, 'ANSWER')));

        // Add Exiles
        exiles.forEach((w) => newPoints.push(createPoint(w, 'EXILE')));

        setPoints(newPoints);
      } catch (err) {
        console.error("Error generating galaxy data:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    // Defer execution to next tick to allow UI to render loading state if needed
    setTimeout(generateData, 0);

    return () => { mounted = false; };
  }, [pool, centerLetter, outerLetters, answers, scorer, sortedLetters]);

  return { points, loading, sortedLetters };
};
