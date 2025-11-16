import type { DateTime } from 'luxon';
import QuickLRU from 'quick-lru';
import { type OnePuzzle, DBPuzzleSchema } from '@lib/puzzle';
import { DbWordFrequencyRowSchema } from '@lib/word-freqs/schemas';

const puzzleCache = new QuickLRU<string, OnePuzzle>({ maxSize: 10 });

// Database query functions
export async function getPuzzleFromDB(
  env: Env,
  date: DateTime
): Promise<OnePuzzle | null> {
  const dateStr = date.toISODate()!;
  if (puzzleCache.has(dateStr)) {
    return puzzleCache.get(dateStr)!;
  }

  // Get puzzle metadata
  const puzzleStmt = env.bee_puzzles
    .prepare(
      `
    SELECT date, centerLetter, outerLetters
    FROM puzzles
    WHERE date = ?
  `
    )
    .bind(dateStr);

  const puzzleResult = await puzzleStmt.first();
  if (!puzzleResult) return null;

  // Parse JSON arrays using Zod schema
  const dbPuzzle = DBPuzzleSchema.parse(puzzleResult);
  const outerLetters = JSON.parse(dbPuzzle.outerLetters);

  // Reconstruct answers from word_dates table
  const answersStmt = env.bee_puzzles
    .prepare(
      `
    SELECT word FROM word_dates WHERE date = ? ORDER BY word
  `
    )
    .bind(dateStr);

  const answersResult = await answersStmt.all();
  const answers = answersResult.results.map((row) => row.word as string);

  // Derive computed values
  const validLetters = [dbPuzzle.centerLetter, ...outerLetters];
  const pangrams = answers.filter((answer: string) => {
    const uniqueLetters = new Set(answer.split(''));
    return (
      uniqueLetters.size === validLetters.length &&
      uniqueLetters.has(dbPuzzle.centerLetter)
    );
  });

  const puzzle: OnePuzzle = {
    displayDate: date.toFormat('LLLL d, yyyy'),
    printDate: dbPuzzle.date,
    centerLetter: dbPuzzle.centerLetter,
    outerLetters,
    validLetters,
    pangrams,
    answers,
  };

  puzzleCache.set(dateStr, puzzle);

  return puzzle;
}

const datesForWordCache = new QuickLRU<string, string[]>({ maxSize: 300 });
export async function getDatesForWord(
  env: Env,
  word: string
): Promise<string[]> {
  if (!datesForWordCache.has(word.toLowerCase())) {
    const stmt = env.bee_puzzles
      .prepare(
        `
    SELECT date
    FROM word_dates
    WHERE word = ?
    ORDER BY date
  `
      )
      .bind(word.toLowerCase());

    const results = await stmt.all();
    const dates = results.results.map((row) => row.date as string);
    datesForWordCache.set(word.toLowerCase(), dates);
  }
  return datesForWordCache.get(word.toLowerCase())!;
}

export async function getWordFrequencies(
  env: Env,
  words: string[]
): Promise<Map<string, number>> {
  if (words.length === 0) return new Map();

  const placeholders = words.map(() => '?').join(',');
  const stmt = env.bee_puzzles
    .prepare(
      `
    SELECT word, frequency
    FROM word_frequencies
    WHERE word IN (${placeholders})
  `
    )
    .bind(...words.map((w) => w.toLowerCase()));

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

  const lowerWords = words.map((w) => w.toLowerCase());
  const placeholders = lowerWords.map(() => '?').join(',');

  const stmt = env.bee_puzzles
    .prepare(
      `
    SELECT word, date
    FROM word_dates
    WHERE word IN (${placeholders}) AND date < ?
    ORDER BY date
  `
    )
    .bind(...lowerWords, beforeDate);

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
