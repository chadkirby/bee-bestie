import type { D1Database } from '@cloudflare/workers-types';
import type { DateTime } from 'luxon';
import { type OnePuzzle, type DBPuzzle, DBPuzzleSchema } from './schemas.js';
import { DbWordFrequencyRowSchema } from '@lib/word-freqs/schemas';
import { memoize } from './memoize.js';

let dbMgr: DbManager | null = null;
export function getDbManager(db: D1Database): DbManager {
  dbMgr ??= new DbManager(db);
  return dbMgr;
}

class DbManager {
  constructor(private readonly db: D1Database) {}

  @memoize(3)
  async getPuzzle(date: DateTime): Promise<OnePuzzle | null> {
    const dateStr = date.toISODate()!;

    // Get puzzle metadata
    const puzzleStmt = this.db
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
    const answersStmt = this.db
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

    return puzzle;
  }

  @memoize(200)
  async getDatesForWord(word: string): Promise<string[]> {
    const stmt = this.db
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
    return dates;
  }

  @memoize(200)
  async getWordFrequencies(words: string[]): Promise<Map<string, number>> {
    if (words.length === 0) return new Map();

    const placeholders = words.map(() => '?').join(',');
    const stmt = this.db
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

  @memoize(200)
  async getWordSBStats(
    words: string[],
    beforeDate: string
  ): Promise<Map<string, SbHistory>> {
    if (words.length === 0) return new Map();

    const lowerWords = words.map((w) => w.toLowerCase());
    const placeholders = lowerWords.map(() => '?').join(',');

    const stmt = this.db
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

  @memoize(100)
  async puzzleExists(date: string): Promise<boolean> {
    const stmt = this.db
      .prepare(
        `
        SELECT 1 FROM puzzles WHERE date = ? LIMIT 1
      `
      )
      .bind(date);

    const result = await stmt.first();
    return result !== null;
  }

  async insertPuzzle(puzzle: DBPuzzle): Promise<boolean> {
    const stmt = this.db
      .prepare(
        `
        INSERT OR IGNORE INTO puzzles (date, centerLetter, outerLetters)
        VALUES (?, ?, ?)
      `
      )
      .bind(puzzle.date, puzzle.centerLetter, puzzle.outerLetters);

    const result = await stmt.run();
    const changes = result.meta?.changes || 0;
    return changes > 0;
  }

  async insertWordDates(
    wordDates: Array<{ word: string; date: string }>
  ): Promise<number> {
    if (wordDates.length === 0) return 0;

    const statements = wordDates.map(({ word, date }) =>
      this.db
        .prepare(
          `
          INSERT OR IGNORE INTO word_dates (word, date)
          VALUES (?, ?)
        `
        )
        .bind(word.toLowerCase(), date)
    );

    const results = await this.db.batch(statements);
    return results.reduce(
      (sum, result) => sum + (result.meta?.changes || 0),
      0
    );
  }

  async upsertPuzzleWithWords(
    puzzle: DBPuzzle,
    words: string[]
  ): Promise<{ puzzleInserted: boolean; wordDatesInserted: number }> {
    // Insert/update puzzle
    const puzzleInserted = await this.insertPuzzle(puzzle);

    // Insert word-date relationships
    const wordDates = words.map((word) => ({ word, date: puzzle.date }));
    const wordDatesInserted = await this.insertWordDates(wordDates);

    return { puzzleInserted, wordDatesInserted };
  }

  @memoize(3600) // Cache for 1 hour
  async getSbCorpusStats(): Promise<{
    totalFrequency: number;
    maxFrequency: number;
    minFrequency: number;
  }> {
    // Total frequency (total number of word occurrences)
    const totalStmt = this.db.prepare(
      'SELECT COUNT(*) as count FROM word_dates'
    );
    const totalResult = await totalStmt.first<{ count: number }>();
    const totalFrequency = totalResult?.count || 0;

    // Max frequency (most frequent word count)
    const maxStmt = this.db.prepare(
      `
      SELECT COUNT(*) as count
      FROM word_dates
      GROUP BY word
      ORDER BY count DESC
      LIMIT 1
      `
    );
    const maxResult = await maxStmt.first<{ count: number }>();
    const maxFrequency = maxResult?.count || 0;

    // Min frequency (least frequent word count) - usually 1
    const minStmt = this.db.prepare(
      `
      SELECT COUNT(*) as count
      FROM word_dates
      GROUP BY word
      ORDER BY count ASC
      LIMIT 1
      `
    );
    const minResult = await minStmt.first<{ count: number }>();
    const minFrequency = minResult?.count || 1;

    return {
      totalFrequency,
      maxFrequency,
      minFrequency,
    };
  }

  @memoize(200)
  async getHyphenates(
    word: string
  ): Promise<Array<{ form: string; frequency: number }>> {
    const stmt = this.db
      .prepare(
        `
        SELECT h.hyphenated_form, wf.frequency
        FROM hyphenates h
        LEFT JOIN word_frequencies wf ON h.hyphenated_form = wf.word
        WHERE h.word = ?
        ORDER BY wf.frequency DESC
      `
      )
      .bind(word.toLowerCase());

    const results = await stmt.all();
    return results.results.map((row) => ({
      form: row.hyphenated_form as string,
      frequency: (row.frequency as number) || 0,
    }));
  }
}

export type SbHistory = {
  /** All historical puzzle dates where this word appeared (ISO strings). */
  dates: string[];
};
