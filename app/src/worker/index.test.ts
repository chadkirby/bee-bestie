/// <reference types="@cloudflare/vitest-pool-workers" />
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from './index';

describe('Worker Routes', () => {
  it('GET /puzzle/:date returns 404 if puzzle not found', async () => {
    const request = new Request('http://example.com/puzzle/1900-01-01');
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(404);
  });

  it('GET /word returns 404 if word param is missing', async () => {
    const request = new Request('http://example.com/word');
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('404 Not Found');
  });

  it('GET /word returns 200 with comprehensive word data', async () => {
    // Note: This test relies on the DB binding.
    // In a real integration test, we might want to seed the DB or mock it.
    // For now, we assume the DB binding is available via `env`.
    // If the DB is empty, it should return empty arrays/default values.
    const request = new Request('http://example.com/word/hello');
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(200);
    const body = (await response.json()) as any;
    expect(body).toHaveProperty('word', 'hello');
    expect(body).toHaveProperty('frequency');
    expect(body).toHaveProperty('commonality');
    expect(body).toHaveProperty('obscurity');
    expect(body).toHaveProperty('probability');
    expect(body).toHaveProperty('phonotacticScore');
    expect(body).toHaveProperty('spellingBeeOccurrences');
    expect(Array.isArray(body.spellingBeeOccurrences)).toBe(true);
  });

  it('GET /puzzle/:pool/phonotactic returns 404 for invalid pool', async () => {
    const request = new Request('http://example.com/puzzle/123/phonotactic');
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(404);
  });
});
