import { z } from 'zod/mini';

// Schema for word-stats response
const WordStatsResponseSchema = z.object({
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

export type WordStatsResponse = z.infer<typeof WordStatsResponseSchema>;

/**
 * Tab data fetchers - reusable functions for fetching tab-specific data
 */
export class TabDataService {
  /**
   * Fetch word statistics for a given puzzle date
   */
  static async fetchWordStats(
    puzzleDate: string,
    signal: AbortSignal
  ): Promise<WordStatsResponse> {
    const response = await fetch(`/puzzle/${puzzleDate}/word-stats`, {
      signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return WordStatsResponseSchema.parse(await response.json());
  }

  /**
   * Example: Fetch puzzle hints for a given date
   */
  static async fetchHints(puzzleDate: string, signal: AbortSignal) {
    // This would be implemented when we create the hints endpoint
    const response = await fetch(`/puzzle/${puzzleDate}/hints`, {
      signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Example: Fetch word semantics for a given date
   */
  static async fetchWordSemantics(puzzleDate: string, signal: AbortSignal) {
    // This would be implemented when we create the semantics endpoint
    const response = await fetch(`/puzzle/${puzzleDate}/semantics`, {
      signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }
}
