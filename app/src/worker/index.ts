import { Hono } from 'hono';
import { DateTime } from 'luxon';
import { getDbManager } from '@lib/puzzle';
import { z } from 'zod/mini';
import { getWordStats } from '@lib/word-freqs';
import { PhonotacticScorer } from '@lib/word-freqs/phonotactic';

const app = new Hono<{ Bindings: Env }>();

// Phonotactic model endpoint
app.get('/puzzle/:pool/phonotactic', async (c) => {
  const pool = c.req.param('pool');

  // Validation: pool must be 7 letters
  if (!/^[a-z]{7}$/i.test(pool)) {
    // If it doesn't match, it might be a date, but this route is specific to phonotactic
    // However, the original code had a check: if (param && /^[a-z]{7}$/i.test(param) && parts[3] === 'phonotactic')
    // So if it's not 7 letters, it wouldn't match this route in a strict sense if we use regex in route,
    // but Hono doesn't support regex in param easily without middleware or validator.
    // For now, we'll just return 404 or proceed.
    // Actually, if the user requests /puzzle/2025-11-15/phonotactic, it might match this if we aren't careful.
    // But the original code only handled phonotactic if param was 7 chars.
    // Let's keep the validation inside.
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
});

// Word statistics endpoint
app.get('/puzzle/:date/word-stats', async (c) => {
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
});

// Puzzle endpoint
app.get('/puzzle/:date', async (c) => {
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
});

// Word lookup endpoint
app.get('/word', async (c) => {
  const wordParam = c.req.query('word');
  if (!wordParam) {
    return c.text('Missing word parameter', 400);
  }

  try {
    const dbMgr = getDbManager(c.env.BEE_PUZZLES);
    const dates = await dbMgr.getDatesForWord(wordParam);
    return c.json({ word: wordParam, dates });
  } catch (error) {
    return c.text('Error fetching word data', 500);
  }
});

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
