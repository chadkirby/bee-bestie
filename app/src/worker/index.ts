import { DateTime } from 'luxon';
import { getDbManager } from '@lib/puzzle';
import { z } from 'zod/mini';
import { getWordStats } from '@lib/word-freqs';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // New progressive loading endpoints
    if (url.pathname.startsWith('/puzzle/')) {
      const parts = url.pathname.split('/');
      // parts[0] = '', parts[1] = 'puzzle', parts[2] = pool or date

      // Check if parts[2] looks like a pool (7 letters) or a date
      const param = parts[2];

      // /puzzle/:pool/phonotactic
      if (param && /^[a-z]{7}$/i.test(param) && parts[3] === 'phonotactic') {
        return await handlePhonotactic(param);
      }

      // Existing date-based routes
      const dateParam = param; // /puzzle/2025-11-15

      if (!dateParam) {
        return new Response('Missing date parameter', { status: 400 });
      }

      const date = DateTime.fromFormat(dateParam, 'yyyy-MM-dd');
      if (!date.isValid) {
        return new Response('Invalid date format', { status: 400 });
      }

      try {
        // Check if this is a word-stats request
        if (parts[3] === 'word-stats') {
          return await handleWordStats(env, date);
        }

        // Regular puzzle request (no trailing slash or different endpoint)
        if (!parts[3]) {
          return await handlePuzzle(env, date);
        }

        return new Response('Not found', { status: 404 });
      } catch (error) {
        return new Response('Error fetching puzzle data', { status: 500 });
      }
    }

    if (url.pathname === '/word') {
      const wordParam = url.searchParams.get('word');
      if (!wordParam) {
        return new Response('Missing word parameter', { status: 400 });
      }

      try {
        const dbMgr = getDbManager(env.BEE_PUZZLES);
        const dates = await dbMgr.getDatesForWord(wordParam);
        return new Response(JSON.stringify({ word: wordParam, dates }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response('Error fetching word data', { status: 500 });
      }
    }

    return new Response('Not found', { status: 404 });
  },
};

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

// Phonotactic model endpoint
import { PhonotacticScorer } from '@lib/word-freqs/phonotactic';

async function handlePhonotactic(pool: string) {
  try {
    // Load the full model (this might be cached if the worker stays warm)
    const scorer = await PhonotacticScorer.load();

    // Filter for the specific pool
    const filtered = scorer.filterModel(pool);

    return new Response(JSON.stringify(filtered), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400', // Cache for 1 day
      },
    });
  } catch (error) {
    console.error('Error generating phonotactic model:', error);
    return new Response('Error generating model', { status: 500 });
  }
}
