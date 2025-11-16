import { z } from 'zod/mini';

export const WordStatsSchema = z.object({
  word: z.string(),
  found: z.boolean(),
  frequency: z.number(),
  commonality: z.number(),
  probability: z.number(),
});
export type WordStats = z.infer<typeof WordStatsSchema>;

export type Loader = (char: string) => Promise<Buffer>;

export const WordFreqMetadataSchema = z.object({
  wordCount: z.number(),
  totalFrequency: z.number(),
  minFrequency: z.number(),
  maxFrequency: z.number(),
  meanFrequency: z.number(),
  medianFrequency: z.number(),
  stddevFrequency: z.number(),
  totalArticleCount: z.number(),
  hyphenatesCount: z.number(),
});

export type WordFreqMetadata = z.infer<typeof WordFreqMetadataSchema>;

export const DbWordFrequencySchema = z.object({
  word: z.string(),
  frequency: z.number(),
  articleCount: z.number(),
});

export type DbWordFrequency = z.infer<typeof DbWordFrequencySchema>;

export const DbWordFrequencyRowSchema = z.object({
  word: z.string(),
  frequency: z.number(),
});

export type DbWordFrequencyRow = z.infer<typeof DbWordFrequencyRowSchema>;
