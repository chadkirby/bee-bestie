import { handleMigration } from './handlers/migrate.js';
import { handleSeed } from './handlers/seed.js';
import { handleRebuild } from './handlers/rebuild.js';

interface Env {
  BEE_PUZZLES: D1Database;
  BEE_BUCKET: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      switch (path) {
        case '/': {
          return new Response(JSON.stringify({
            service: 'bee-bestie-initialization',
            version: '1.0.0',
            endpoints: {
              'GET /': 'Service information',
              'POST /migrate': 'Run database migration',
              'POST /seed': 'Seed database with puzzle data',
              'POST /rebuild': 'Complete database rebuild (migration + seed)',
              'GET /status': 'Check database status'
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case '/migrate': {
          if (request.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
              status: 405,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const result = await handleMigration(env);
          return new Response(JSON.stringify(result), {
            status: result.success ? 200 : 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case '/seed': {
          if (request.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
              status: 405,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const urlParams = new URLSearchParams(url.search);
          const dryRun = urlParams.get('dryRun') === 'true';

          const result = await handleSeed(env, { dryRun });
          return new Response(JSON.stringify(result), {
            status: result.success ? 200 : 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case '/rebuild': {
          if (request.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
              status: 405,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const urlParams = new URLSearchParams(url.search);
          const dryRun = urlParams.get('dryRun') === 'true';

          const result = await handleRebuild(env, {
            dryRun,
          });
          return new Response(JSON.stringify(result), {
            status: result.success ? 200 : 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case '/status': {
          if (request.method !== 'GET') {
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
              status: 405,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Check database connectivity and basic table status
          try {
            const puzzleCount = await env.BEE_PUZZLES.prepare('SELECT COUNT(*) as count FROM puzzles').first<{ count: number }>();
            const wordDateCount = await env.BEE_PUZZLES.prepare('SELECT COUNT(*) as count FROM word_dates').first<{ count: number }>();

            const status = {
              database: 'connected',
              tables: {
                puzzles: {
                  exists: true,
                  count: puzzleCount?.count || 0
                },
                word_dates: {
                  exists: true,
                  count: wordDateCount?.count || 0
                }
              }
            };

            return new Response(JSON.stringify(status), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });

          } catch (error) {
            return new Response(JSON.stringify({
              database: 'error',
              error: error instanceof Error ? error.message : 'Unknown database error'
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }

        default: {
          return new Response(JSON.stringify({ error: 'Not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};
