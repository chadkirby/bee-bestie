import type { DateTime } from 'luxon';
import { type OnePuzzle, DBPuzzleSchema } from '@lib/puzzle';
import {
  DbWordFrequencySchema,
  DbWordFrequencyRowSchema,
} from '@lib/word-freqs/schemas';

// Database query functions
export async function getPuzzleFromDB(env: Env, date: DateTime): Promise<OnePuzzle | null> {
  const dateStr = date.toISODate()!;

  // Get puzzle metadata
  const puzzleStmt = env.bee_puzzles.prepare(`
    SELECT date, centerLetter, outerLetters
    FROM puzzles
    WHERE date = ?
  `).bind(dateStr);

  const puzzleResult = await puzzleStmt.first();
  if (!puzzleResult) return null;

  // Parse JSON arrays using Zod schema
  const dbPuzzle = DBPuzzleSchema.parse(puzzleResult);
  const outerLetters = JSON.parse(dbPuzzle.outerLetters);

  // Reconstruct answers from word_dates table
  const answersStmt = env.bee_puzzles.prepare(`
    SELECT word FROM word_dates WHERE date = ? ORDER BY word
  `).bind(dateStr);

  const answersResult = await answersStmt.all();
  const answers = answersResult.results.map(row => row.word as string);

  // Derive computed values
  const validLetters = [dbPuzzle.centerLetter, ...outerLetters];
  const pangrams = answers.filter((answer: string) => {
    const uniqueLetters = new Set(answer.split(''));
    return uniqueLetters.size === validLetters.length &&
           uniqueLetters.has(dbPuzzle.centerLetter);
  });

  return {
    displayDate: date.toFormat('LLLL d, yyyy'),
    printDate: dbPuzzle.date,
    centerLetter: dbPuzzle.centerLetter,
    outerLetters,
    validLetters,
    pangrams,
    answers
  };
}

export async function getDatesForWord(env: Env, word: string): Promise<string[]> {
  const stmt = env.bee_puzzles.prepare(`
    SELECT date
    FROM word_dates
    WHERE word = ?
    ORDER BY date
  `).bind(word.toLowerCase());

  const results = await stmt.all();
  return results.results.map(row => row.date as string);
}

export async function getWordFrequency(env: Env, word: string): Promise<number | null> {
  const stmt = env.bee_puzzles.prepare(`
    SELECT frequency
    FROM word_frequencies
    WHERE word = ?
  `).bind(word.toLowerCase());

  const result = await stmt.first();
  return result ? (result.frequency as number) : null;
}

export async function getWordFrequencies(env: Env, words: string[]): Promise<Map<string, number>> {
  if (words.length === 0) return new Map();

  const placeholders = words.map(() => '?').join(',');
  const stmt = env.bee_puzzles.prepare(`
    SELECT word, frequency
    FROM word_frequencies
    WHERE word IN (${placeholders})
  `).bind(...words.map(w => w.toLowerCase()));

  const results = await stmt.all();
  const freqMap = new Map<string, number>();
  for (const row of results.results) {
    const parsedRow = DbWordFrequencyRowSchema.parse(row);
    freqMap.set(parsedRow.word, parsedRow.frequency);
  }
  return freqMap;
}

export type SbHistory = {
  /** All historical puzzle dates where this word appeared (ISO strings). */
  dates: string[];
};

export async function getWordSBStats(
  env: Env,
  words: string[],
  beforeDate: string
): Promise<Map<string, SbHistory>> {
  if (words.length === 0) return new Map();

  const lowerWords = words.map(w => w.toLowerCase());
  const placeholders = lowerWords.map(() => '?').join(',');

  const stmt = env.bee_puzzles.prepare(`
    SELECT word, date
    FROM word_dates
    WHERE word IN (${placeholders}) AND date < ?
    ORDER BY date
  `).bind(...lowerWords, beforeDate);

  const results = await stmt.all();
  const historyMap = new Map<string, SbHistory>();

  for (const row of results.results) {
    const word = (row.word as string).toLowerCase();
    const date = row.date as string;
    const existing = historyMap.get(word);
    if (existing) {
      existing.dates.push(date);
    } else {
      historyMap.set(word, { dates: [date] });
    }
  }

  return historyMap;
}

export async function getGame(date: DateTime): Promise<OnePuzzle>{
  const res = await fetch(
    `https://beesolver.com/${date.toFormat('yyyy-MM-dd')}/answers`
  );
  const data = {
    centerLetter: '',
    outerLetters: '',
    solutions: [] as string[][],
  };
  const response = new HTMLRewriter()
    .on('input', {
      element(element) {
        if (element.getAttribute('name') === 'centerLetter') {
          data.centerLetter = element.getAttribute('value') || '';
        } else if (element.getAttribute('name') === 'outerLetters') {
          data.outerLetters += element.getAttribute('value') || '';
        }
      },
    })
    .on('li', {
      element() {
        data.solutions.push([]);
      },
      text(text) {
        data.solutions.at(-1)!.push(text.text);
      },
    })
    .transform(res);

  await response.arrayBuffer(); // Ensure the response is fully processed

  // convert to PuzzleData format
  const outerLetters = Array.from(new Set(data.outerLetters.split('')));
  const validLetters = Array.from(new Set([data.centerLetter, ...outerLetters]));
  const pangrams = new Set(data.solutions
    .map((s) => s.join(''))
    .filter((s) => {
      const uniqueLetters = new Set(s.split(''));
      return (
        uniqueLetters.size === validLetters.length &&
        uniqueLetters.has(data.centerLetter)
      );
    }));
  const puzzle: OnePuzzle = {
    displayDate: date.toFormat('LLLL d, yyyy'),
    printDate: date.toISODate()!,
    centerLetter: data.centerLetter,
    outerLetters,
    validLetters,
    pangrams: Array.from(pangrams),
    answers: Array.from(new Set(data.solutions.map((s) => s.join('')))),
  };


  return puzzle;
}
