import { DateTime } from 'luxon';
import {
  getPuzzleFromDB,
  getDatesForWord,
  getWordFrequencies,
  getWordSBStats,
} from './fetch-game';
import { z } from 'zod/mini';
import { WordFreqMetadataSchema, getWordStats } from '@lib/word-freqs';
import { DateResponse } from '@/lib/load-data.ts';

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
  const puzzle = await getPuzzleFromDB(env, date);

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
  const puzzle = await getPuzzleFromDB(env, date);

  if (!puzzle) {
    return new Response('Puzzle not found for the given date', {
      status: 404,
    });
  }

  // Get word frequency metadata from R2 bucket
  const BEE_BUCKET = env.BEE_BUCKET;
  if (!BEE_BUCKET) {
    return new Response('BEE_BUCKET not configured', { status: 500 });
  }

  const metadata = await loadJSON(
    BEE_BUCKET,
    'word_stats-metadata.json',
    WordFreqMetadataSchema
  );

  // Get frequencies and Spelling Bee history for all answer words from DB
  const freqMap = await getWordFrequencies(env, puzzle.answers);
  const sbHistoryMap = await getWordSBStats(
    env,
    puzzle.answers,
    date.toISODate()!
  );

  // Compute word stats for each answer word
  const wordStats = puzzle.answers.map((word) => {
    const lower = word.toLowerCase();
    const frequency = freqMap.get(lower) || 0;
    const stats = getWordStats(metadata, frequency);
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

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // New progressive loading endpoints
    if (url.pathname.startsWith('/puzzle/')) {
      const parts = url.pathname.split('/');
      const dateParam = parts[2]; // /puzzle/2025-11-15

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

    // Legacy endpoints for backward compatibility
    if (url.pathname === '/date' || url.pathname === '/today') {
      const dateParam =
        url.pathname === '/date'
          ? url.searchParams.get('date')
          : DateTime.now().toISODate();
      if (!dateParam) {
        return new Response('Missing date parameter', { status: 400 });
      }

      const date = DateTime.fromFormat(dateParam, 'yyyy-MM-dd');

      try {
        const puzzle = await getPuzzleFromDB(env, date);

        if (puzzle) {
          // Get word frequency metadata from R2 bucket (still small)
          const BEE_BUCKET = env.BEE_BUCKET;
          if (!BEE_BUCKET) {
            return new Response('BEE_BUCKET not configured', { status: 500 });
          }

          const metadata = await loadJSON(
            BEE_BUCKET,
            'word_stats-metadata.json',
            WordFreqMetadataSchema
          );

          // Get frequencies and Spelling Bee history for all answer words from DB
          const freqMap = await getWordFrequencies(env, puzzle.answers);
          const sbHistoryMap = await getWordSBStats(
            env,
            puzzle.answers,
            date.toISODate()!
          );

          // Compute word stats for each answer word
          const wordStats = puzzle.answers.map((word) => {
            const lower = word.toLowerCase();
            const frequency = freqMap.get(lower) || 0;
            const stats = getWordStats(metadata, frequency);
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

          return new Response(
            JSON.stringify({ puzzle, wordStats } as DateResponse),
            {
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        return new Response('Puzzle not found for the given date', {
          status: 404,
        });
      } catch (error) {
        return new Response('Error fetching game data', { status: 500 });
      }
    }

    if (url.pathname === '/word') {
      const wordParam = url.searchParams.get('word');
      if (!wordParam) {
        return new Response('Missing word parameter', { status: 400 });
      }

      try {
        const dates = await getDatesForWord(env, wordParam);
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
