import { Hono } from 'hono';
import { DateTime } from 'luxon';
import { getDbManager } from '@lib/puzzle';
import { z } from 'zod/mini';
import { getWordStats } from '@lib/word-freqs';
import { PhonotacticScorer } from '@lib/word-freqs/phonotactic';

// Helper to check if a word is a pangram (uses all 7 letters)
function isPangram(word: string): boolean {
  return new Set(word).size === 7;
}


const app = new Hono<{ Bindings: Env }>()

  // Phonotactic model endpoint
  .get('/puzzle/:pool/phonotactic', async (c) => {
    const pool = c.req.param('pool');

    // Validation: pool must be 7 letters
    if (!/^[a-z]{7}$/i.test(pool)) {
      return c.notFound();
    }

    try {
      // Load the full model (this might be cached if the worker stays warm)
      const scorer = await PhonotacticScorer.load();

      // Filter for the specific pool
      const filtered = scorer.filterModel(pool);

      return c.json(filtered, 200, {
        'Cache-Control': 'public, max-age=86400', // Cache for 1 day
      });
    } catch (error) {
      console.error('Error generating phonotactic model:', error);
      return c.text('Error generating model', 500);
    }
  })

  // Word statistics endpoint
  .get('/puzzle/:date/word-stats', async (c) => {
    const dateParam = c.req.param('date');
    const date = DateTime.fromFormat(dateParam, 'yyyy-MM-dd');

    if (!date.isValid) {
      return c.text('Invalid date format', 400);
    }

    try {
      return await handleWordStats(c.env, date);
    } catch (error) {
      return c.text('Error fetching puzzle data', 500);
    }
  })

  // Puzzle endpoint
  .get('/puzzle/:date', async (c) => {
    const dateParam = c.req.param('date');
    const date = DateTime.fromFormat(dateParam, 'yyyy-MM-dd');

    if (!date.isValid) {
      return c.text('Invalid date format', 400);
    }

    try {
      return await handlePuzzle(c.env, date);
    } catch (error) {
      return c.text('Error fetching puzzle data', 500);
    }
  })

  // Word lookup endpoint
  .get('/word/:word', async (c) => {
    const wordParam = c.req.param('word');
    if (!wordParam) {
      return c.text('Missing word parameter', 400);
    }

    try {
      return await handleWordDetails(c.env, wordParam);
    } catch (error) {
      console.error('Error fetching word data:', error);
      return c.text('Error fetching word data', 500);
    }
  });

export type AppType = typeof app;
export default app;

async function loadJSON<T extends z.ZodMiniType<any>>(
  bucketBinding: R2Bucket,
  path: string,
  schema: T
): Promise<z.infer<T>> {
  const file = await bucketBinding.get(path);
  if (!file || !file.body) {
    throw new Error(`File not found: ${path}`);
  }
  const text = await file.text();
  const json = JSON.parse(text);
  return schema.parse(json);
}

// Fast endpoint: Puzzle data only
async function handlePuzzle(env: Env, date: DateTime) {
  const dbMgr = getDbManager(env.BEE_PUZZLES);
  const puzzle = await dbMgr.getPuzzle(date);

  if (!puzzle) {
    return new Response('Puzzle not found for the given date', {
      status: 404,
    });
  }

  return new Response(JSON.stringify({ puzzle }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// Slower endpoint: Word statistics only
async function handleWordStats(env: Env, date: DateTime) {
  const dbMgr = getDbManager(env.BEE_PUZZLES);
  const puzzle = await dbMgr.getPuzzle(date);

  if (!puzzle) {
    return new Response('Puzzle not found for the given date', {
      status: 404,
    });
  }

  // Get frequencies and Spelling Bee history for all answer words from DB
  const freqMap = await dbMgr.getWordFrequencies(puzzle.answers);
  const sbHistoryMap = await dbMgr.getWordSBStats(
    puzzle.answers,
    date.toISODate()!
  );

  // Compute word stats for each answer word
  const wordStats = puzzle.answers.map((word) => {
    const lower = word.toLowerCase();
    const frequency = freqMap.get(lower) || 0;
    const stats = getWordStats(frequency);
    const sbHistory = sbHistoryMap.get(lower);

    return {
      word,
      found: frequency > 0,
      frequency,
      commonality: stats.commonality,
      probability: stats.probability,
      sbHistory: sbHistory?.dates ?? [],
    };
  });

  return new Response(JSON.stringify({ wordStats }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// Word details endpoint: Comprehensive word information
async function handleWordDetails(env: Env, word: string) {
  const dbMgr = getDbManager(env.BEE_PUZZLES);
  const lower = word.toLowerCase();

  // Get Spelling Bee history (all dates where this word appeared)
  const dates = await dbMgr.getDatesForWord(lower);

  // Get frequency from Wikipedia corpus
  const freqMap = await dbMgr.getWordFrequencies([lower]);
  const frequency = freqMap.get(lower) || 0;

  // Calculate commonality/obscurity metric
  const stats = getWordStats(frequency);

  // Calculate phonotactic score (how word-like it is)
  const scorer = await PhonotacticScorer.load();
  const phonotacticScore = scorer.score(lower);

  // For each date, get puzzle info (just the minimal data)
  const spellingBeeOccurrences = await Promise.all(
    dates.map(async (date) => {
      const dateObj = DateTime.fromISO(date);
      const puzzle = await dbMgr.getPuzzle(dateObj);

      if (!puzzle) {
        return {
          date,
          centerLetter: '',
          outerLetters: [],
        };
      }

      return {
        date,
        centerLetter: puzzle.centerLetter,
        outerLetters: puzzle.outerLetters,
      };
    })
  );

  return new Response(
    JSON.stringify({
      word: lower,
      frequency,
      commonality: stats.commonality,
      obscurity: 1 - stats.commonality, // Obscurity is inverse of commonality
      probability: stats.probability,
      phonotacticScore,
      spellingBeeOccurrences,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
