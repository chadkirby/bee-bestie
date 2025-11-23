import { useEffect, useRef, useState } from 'react';
import { PhonotacticScorer } from '@lib/word-freqs/phonotactic';
import { Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { hc } from 'hono/client';
import type { AppType } from '../worker/index';

const client = hc<AppType>('/');

interface TeletypeProps {
  center: string;
  outer: string;
  forbiddenWords?: string[];
  className?: string;
}

export function Teletype({ center, outer, forbiddenWords = [], className }: TeletypeProps) {
  const [currentWord, setCurrentWord] = useState('');
  const [scorer, setScorer] = useState<PhonotacticScorer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const pool = center + outer;

  // Load model
  useEffect(() => {
    let mounted = true;

    async function loadModel() {
      try {
        const res = await client.puzzle[':pool'].phonotactic.$get({
          param: { pool },
        });
        if (!res.ok) throw new Error('Failed to load model');

        const modelData = await res.json();
        const newScorer = new PhonotacticScorer();
        // @ts-expect-error JSON import typing
        newScorer.importModel(modelData);

        if (mounted) {
          setScorer(newScorer);
        }
      } catch (err) {
        console.error(err);
        if (mounted) setError('Failed to load word generator');
      }
    }

    loadModel();

    return () => { mounted = false; };
  }, [pool]);

  const isPausedRef = useRef(isPaused);
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Keep track of seen words to avoid repetition
  const seenWordsRef = useRef<Set<string>>(new Set());

  // Animation loop
  useEffect(() => {
    if (!scorer) return;

    let animationFrameId: number;
    let lastTime = 0;
    const charDelay = 50; // ms per character
    const wordPauseDelay = 150; // ms to pause at full word
    const backspaceDelay = 30; // ms per backspace (faster than typing)

    let state: 'typing' | 'waiting' | 'backspacing' = 'typing';

    const getNextWord = () => {
      const maxAttempts = 50;
      const forbiddenSet = new Set(forbiddenWords);

      for (let i = 0; i < maxAttempts; i++) {
        // Pick a random length between 4 and 12
        const targetLen = Math.floor(Math.random() * (12 - 4 + 1)) + 4;

        const w = scorer.getRandomViableWord({
          pool: outer + center,
          center,
          minLen: targetLen,
          maxLen: targetLen,
          maxRetries: 100
        });

        if (w && !seenWordsRef.current.has(w) && !forbiddenSet.has(w)) {
          seenWordsRef.current.add(w);
          if (seenWordsRef.current.size > 5000) {
            seenWordsRef.current.clear();
          }
          return w;
        }
      }

      // Fallback: Try any length if specific length fails repeatedly
      // We still try to avoid forbidden words here if possible, but if getRandomViableWord
      // just returns one, we might need to retry a few times.
      for (let k = 0; k < 10; k++) {
        const w = scorer.getRandomViableWord({
          pool: outer + center,
          center,
          minLen: 4,
          maxLen: 12
        });
        if (w && !forbiddenSet.has(w)) return w;
      }

      // Last resort, just return whatever (or maybe null/empty string if we really want to be strict)
      return scorer.getRandomViableWord({
        pool: outer + center,
        center,
        minLen: 4,
        maxLen: 12
      });
    };

    let targetWord = getNextWord() || 'loading...';
    let charIndex = 0;
    let waitStartTime = 0;

    const animate = (time: number) => {
      if (!lastTime) lastTime = time;

      if (isPausedRef.current) {
        lastTime = time;
        animationFrameId = requestAnimationFrame(animate);
        return;
      }

      if (state === 'typing') {
        if (time - lastTime > charDelay) {
          lastTime = time;
          charIndex++;
          setCurrentWord(targetWord.slice(0, charIndex));

          if (charIndex >= targetWord.length) {
            state = 'waiting';
            waitStartTime = time;
          }
        }
      } else if (state === 'waiting') {
        if (time - waitStartTime > wordPauseDelay) {
          state = 'backspacing';
          lastTime = time;
        }
      } else if (state === 'backspacing') {
        if (time - lastTime > backspaceDelay) {
          lastTime = time;
          charIndex--;
          setCurrentWord(targetWord.slice(0, charIndex));

          if (charIndex <= 0) {
            state = 'typing';
            targetWord = getNextWord() || '...';
            charIndex = 0;
            lastTime = time;
          }
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [scorer, center, outer]);

  if (error) return null;

  return (
    <div className={`relative font-mono text-sm opacity-70 bg-black/5 p-3 rounded-md flex items-center group ${className || ''}`}>
      {/* Controls */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setIsPaused(!isPaused)}
        >
          {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </Button>
      </div>

      {/* Single line display */}
      <div className="text-primary font-bold">
        {currentWord}<span className="animate-pulse">_</span>
      </div>
    </div>
  );
}
