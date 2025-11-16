import { z } from 'zod/mini';
import { OnePuzzleSchema } from '@lib/puzzle';

export const DateResponseSchema = z.object({
  puzzle: OnePuzzleSchema,
  wordStats: z.array(
    z.object({
      word: z.string(),
      found: z.boolean(),
      frequency: z.number(),
      commonality: z.number(),
      probability: z.number(),
      sbHistory: z.array(z.string()),
    })
  ),
});

export type DateResponse = z.infer<typeof DateResponseSchema>;
