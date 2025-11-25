import { z } from 'zod/mini';
import { hc } from 'hono/client';
import type { AppType } from '../worker/index';

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

// Schema for word-details response
const WordDetailsResponseSchema = z.object({
  word: z.string(),
  frequency: z.number(),
  totalWikipediaFrequency: z.number(),
  commonality: z.number(),
  obscurity: z.number(),
  probability: z.number(),
  sbCommonality: z.number(),
  totalSbFrequency: z.number(),
  spellingBeeOccurrences: z.array(
    z.object({
      date: z.string(),
      centerLetter: z.string(),
      outerLetters: z.array(z.string()),
    })
  ),
  hyphenates: z.array(
    z.object({
      form: z.string(),
      frequency: z.number(),
      commonality: z.number(),
    })
  ),
});

export type WordDetailsResponse = z.infer<typeof WordDetailsResponseSchema>;

// Schema for exiles response
const ExilesResponseSchema = z.object({
  words: z.array(z.string()),
});

export type ExilesResponse = z.infer<typeof ExilesResponseSchema>;

const client = hc<AppType>('/');

/**
 * Tab data fetchers - reusable functions for fetching tab-specific data
 */
export class TabDataService {
  /**
   * Fetch comprehensive details for a given word
   */
  static async fetchWordDetails(
    word: string,
    signal?: AbortSignal
  ): Promise<WordDetailsResponse> {
    const response = await client.word[':word'].$get(
      {
        param: { word },
      },
      { init: { signal } }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return WordDetailsResponseSchema.parse(await response.json());
  }

  /**
   * Fetch word statistics for a given puzzle date
   */
  static async fetchWordStats(
    puzzleDate: string,
    signal: AbortSignal
  ): Promise<WordStatsResponse> {
    const response = await client.puzzle[':date']['word-stats'].$get(
      {
        param: { date: puzzleDate },
      },
      { init: { signal } }
    );

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
    // Placeholder for now as the endpoint doesn't exist in the worker yet
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
    // Placeholder for now as the endpoint doesn't exist in the worker yet
    const response = await fetch(`/puzzle/${puzzleDate}/semantics`, {
      signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }
  /**
   * Fetch phonotactic model for a given letter pool
   */
  static async fetchPhonotacticModel(pool: string, signal?: AbortSignal) {
    const response = await client.puzzle[':pool'].phonotactic.$get(
      {
        param: { pool },
      },
      { init: { signal } }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Fetch exiles (valid words not in answers) for a given letter pool
   */
  static async fetchExiles(
    pool: string,
    requiredLetter: string,
    signal?: AbortSignal
  ): Promise<ExilesResponse> {
    const response = await client.puzzle[':pool'].exiles.$get(
      {
        param: { pool },
        query: { requiredLetter },
      },
      { init: { signal } }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return ExilesResponseSchema.parse(data);
  }
}
