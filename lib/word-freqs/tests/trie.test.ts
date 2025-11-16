import { assert, test } from 'vitest';
import { WordFreqTrie, type Loader } from '../src/index.js';
import { readFile } from 'node:fs/promises';
import metadata from './fixtures/word_stats-metadata.json' with { type: 'json' };
import freqs from './fixtures/word_stats-sorted-freqs.json' with { type: 'json' };

const fsLoader: Loader = async (char: string) => {
  return await readFile(
    `${import.meta.dirname}/fixtures/word_stats-${char.toLowerCase()}.mpck.gz`
  );
};
function createTrie(): WordFreqTrie {
  return new WordFreqTrie(metadata, freqs, fsLoader);
}

test('Trie find existing word', async () => {
  const trie = createTrie();
  const stats = await trie.find('example');
  assert.deepEqual(stats, {
    commonality: 0.789078617646371,
    found: true,
    frequency: 401670,
    probability: 0.0005570614210788713,
    word: 'example',
  });
});

test('Trie find non-existing word', async () => {
  const trie = createTrie();
  const stats = await trie.find('nonexistentword');
  assert.equal(stats.found, false);
  assert(stats.frequency >= 0);
  assert(stats.commonality >= 0 && stats.commonality <= 1);
  assert(stats.probability >= 0 && stats.probability <= 1);
});

test('Trie find empty string', async () => {
  const trie = createTrie();
  const stats = await trie.find('');
  assert.equal(stats.found, false);
  assert.equal(stats.frequency, 0); // fallbackFreq defaults to 0
  assert(stats.commonality >= 0 && stats.commonality <= 1);
  assert.equal(stats.probability, 0);
});

test('Trie find with fallback frequency', async () => {
  const trie = createTrie();
  const fallbackFreq = 100;
  const stats = await trie.find('definitelynotarealword', fallbackFreq);
  assert.equal(stats.found, false);
  assert.equal(stats.frequency, fallbackFreq);
});



test('Trie solve basic spelling bee puzzle', async () => {
  const trie = createTrie();
  const results = await trie.solve(['a', 'b', 'c', 'd', 'e'], 'a', 4);

  // Should find some valid words
  assert(Array.isArray(results));
  results.forEach(result => {
    assert(typeof result.word === 'string');
    assert(result.word.length >= 4);
    assert(result.word.toLowerCase().includes('a'));
    assert(result.frequency > 0);
    // Verify all letters are valid
    for (const char of result.word.toLowerCase()) {
      assert(['a', 'b', 'c', 'd', 'e'].includes(char));
    }
  });
});

test('Trie solve with different min lengths', async () => {
  const trie = createTrie();
  const longWords = await trie.solve(['a', 'b', 'c', 'd', 'e'], 'a', 5);
  const shortWords = await trie.solve(['a', 'b', 'c', 'd', 'e'], 'a', 3);

  // All long words should meet longer minimum
  longWords.forEach(result => assert(result.word.length >= 5));
  // Short words list should be at least as long as long words list
  assert(shortWords.length >= longWords.length);
});

test('Trie solve no valid words', async () => {
  const trie = createTrie();
  // Use letters that don't include common required letter 'e'
  const results = await trie.solve(['x', 'y', 'z'], 'e', 4);
  assert.equal(results.length, 0);
});

test('Trie solve words without required letter', async () => {
  const trie = createTrie();
  // Use 'x' as required letter but don't include it in valid letters
  const results = await trie.solve(['a', 'b'], 'x', 4);
  assert.equal(results.length, 0);
});

test('Trie getWordsWithPrefix existing prefix', async () => {
  const trie = createTrie();
  const results = await trie.getWordsWithPrefix('exam');

  assert(Array.isArray(results));
  results.forEach(result => {
    assert(typeof result.word === 'string');
    assert(typeof result.frequency === 'number');
    assert(result.frequency > 0);
    // All results should start with prefix (case insensitive)
    assert(result.word.toLowerCase().startsWith('exam'));
  });
});

test('Trie getWordsWithPrefix non-existing prefix', async () => {
  const trie = createTrie();
  const results = await trie.getWordsWithPrefix('xyzxyz');
  assert(Array.isArray(results));
  assert.equal(results.length, 0);
});

test('Trie getWordsWithPrefix empty string', async () => {
  const trie = createTrie();
  const results = await trie.getWordsWithPrefix('');
  assert(Array.isArray(results));
  assert.equal(results.length, 0);
});



test('Trie getStats returns corpus statistics', async () => {
  const trie = createTrie();

  const stats = trie.getStats();

  assert(typeof stats === 'object');
  assert(typeof stats.wordCount === 'number');
  assert(stats.wordCount > 0);
  assert(typeof stats.totalFrequency === 'number');
  assert(stats.totalFrequency > 0);
  assert(typeof stats.averageFrequency === 'number');
  assert(stats.averageFrequency > 0);
  assert.equal(stats.averageFrequency, stats.totalFrequency / stats.wordCount);
});
