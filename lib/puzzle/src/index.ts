import * as z from "zod/mini";

export const OnePuzzleSchema = z.looseObject({
  displayDate: z.string(), // e.g. "August 9, 2025"
  printDate: z.string(),   // ISO date string "YYYY-MM-DD"
  centerLetter: z.string(),
  outerLetters: z.array(z.string()),
  validLetters: z.array(z.string()),
  pangrams: z.array(z.string()),
  answers: z.array(z.string()),
});

export const PastPuzzlesSchema = z.object({
  today: OnePuzzleSchema,
  yesterday: OnePuzzleSchema,
  thisWeek: z.array(OnePuzzleSchema),
  lastWeek: z.array(OnePuzzleSchema),
});

export const NYTPuzzleDataSchema = z.object({
  today: OnePuzzleSchema,
  yesterday: OnePuzzleSchema,
  pastPuzzles: PastPuzzlesSchema,
});

// Database schema for stored puzzle data
export const DBPuzzleSchema = z.object({
  date: z.string(), // ISO date string
  centerLetter: z.string(),
  outerLetters: z.string(), // JSON string of array
});

export type OnePuzzle = z.infer<typeof OnePuzzleSchema>;
export type PastPuzzles = z.infer<typeof PastPuzzlesSchema>;
export type NYTPuzzleData = z.infer<typeof NYTPuzzleDataSchema>;
export type DBPuzzle = z.infer<typeof DBPuzzleSchema>;

export const WordAnalysisSchema = z.object({
  word: z.string(),
  occurrences: z.array(z.iso.date()),
});

export const GameAnalysisSchema = z.object({
  totalGames: z.number(),
  totalAnswers: z.number(),
  words: z.array(WordAnalysisSchema),
});
