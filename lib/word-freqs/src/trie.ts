import { unpack } from 'msgpackr';
import { createGunzip } from 'node:zlib';
import { z } from 'zod/mini';
import type { Loader, WordFreqMetadata, WordStats } from './word-freq-schemas.js';
import { getWordStats } from './word-stats.js';

export class WordFreqTrie {
  private roots: Record<string, TrieNode> = {};

  constructor(
    private readonly metadata: WordFreqMetadata,
    private readonly frequenciesSorted: number[],
    private readonly loader: Loader
  ) {}

  /**
   * Finds all valid words in the trie that solve a spelling bee puzzle.
   * @param validLetters - Array of allowed letters (case-insensitive).
   * @param requiredLetter - The letter that must appear in every word (case-insensitive).
   * @param minLength - Minimum word length (default 4).
   * @returns Array of objects with { word, frequency } for each valid answer.
   *
   * The spelling bee puzzle requires:
   *   - Each word must use only the valid letters.
   *   - Each word must include the required letter at least once.
   *   - Each word must be at least minLength characters long.
   */
  async solve(
    validLetters: string[],
    requiredLetter: string,
    minLength = 4
  ): Promise<WordStats[]> {
    // Results array to collect valid words
    const results: Array<{
      word: string;
      node: WordNode;
    }> = [];
    // Convert valid letters to a Set for O(1) lookup, and normalize to lowercase
    const validSet = new Set(validLetters.map((c) => c.toLowerCase()));
    // Normalize required letter to lowercase
    const required = requiredLetter.toLowerCase();

    /**
     * Depth-first search helper function.
     * @param node - Current TrieNode in traversal
     * @param prefix - The word built so far
     * @param usedRequired - Whether the required letter has been used in this path
     */
    const dfs = (node: TrieNode, prefix: string, usedRequired: boolean) => {
      // If the current prefix is a valid word (meets length, ends a word, and has frequency)
      if (prefix.length >= minLength && node.isEndOfWord) {
        // Only add if the required letter has been used
        if (usedRequired) {
          results.push({ word: prefix, node });
        }
      }
      // Explore all children (next possible letters)
      for (const [char, child] of Object.entries(node.children)) {
        // Only continue if the next character is in the set of valid letters
        if (validSet.has(char)) {
          // Recurse, updating prefix and whether required letter has been used
          dfs(
            child as TrieNode,
            prefix + char,
            usedRequired || char === required
          );
        }
      }
    };

    // Start DFS from the root with an empty prefix and required letter not yet used
    dfs(await this.getRoot(Array.from(validSet).join('')), '', false);
    // Return all found words
    return results.map(({ word, node }) => ({
      word,
      ...getWordStats(this.metadata, node.frequency),
    }));
  }

  private async getRoot(chars: string): Promise<TrieNode> {
    const children: Record<string, TrieNode> = {};
    for (const char of chars) {
      const child = this.roots[char.toLowerCase()];
      if (!child) {
        const buffer = await this.loader(char);
        // Decompress the gzipped data
        const gunzip = createGunzip();
        const decompressed = await new Promise<Buffer>((resolve, reject) => {
          const chunks: Buffer[] = [];
          gunzip.on('data', (chunk) => chunks.push(chunk));
          gunzip.on('end', () => resolve(Buffer.concat(chunks)));
          gunzip.on('error', (err) => reject(err));
          gunzip.end(buffer);
        });
        const trieNode = unpack(decompressed) as TrieNode;
        this.roots[char] = trieNode as TrieNode;
      }
      children[char] = this.roots[char] as TrieNode;
    }
    return {
      children,
      isEndOfWord: false,
    };
  }

  // Find a word in the trie
  async find(word: string, fallbackFreq = 0): Promise<WordStats> {
    if (!word[0])
      return {
        word,
        ...getWordStats(this.metadata, fallbackFreq),
        found: false,
      };

    let current = await this.getRoot(word[0]);
    if (!current) {
      return {
        word,
        ...getWordStats(this.metadata, fallbackFreq),
        found: false,
      };
    }

    for (const char of word.toLowerCase()) {
      if (!current.children[char]) {
        return {
          word,
          ...getWordStats(this.metadata, fallbackFreq),
          found: false,
        };
      }
      current = current.children[char] as TrieNode;
    }

    if (current.isEndOfWord) {
      // Calculate percentile: percent of words with lower or equal frequency
      return { word, ...getWordStats(this.metadata, current.frequency) };
    } else {
      return {
        word,
        ...getWordStats(this.metadata, fallbackFreq),
        found: false,
      };
    }
  }

  // Get all words with a given prefix
  async getWordsWithPrefix(
    prefix: string
  ): Promise<Array<{ word: string; frequency: number }>> {
    const results: Array<{ word: string; frequency: number }> = [];
    if (!prefix[0]) return results;

    let current = await this.getRoot(prefix[0]);
    if (!current) return results;
    for (const char of prefix.toLowerCase()) {
      if (!current.children[char]) {
        return results;
      }
      current = current.children[char] as TrieNode;
    }

    // DFS from this node
    this.collectWords(current, prefix, results);
    return results;
  }

  private collectWords(
    node: TrieNode,
    prefix: string,
    results: Array<{ word: string; frequency: number }>
  ) {
    if (node.isEndOfWord) {
      results.push({ word: prefix, frequency: node.frequency });
    }

    for (const [char, childNode] of Object.entries(node.children)) {
      this.collectWords(childNode as TrieNode, prefix + char, results);
    }
  }

  // Get statistics
  getStats() {
    return {
      wordCount: this.metadata.wordCount,
      totalFrequency: this.metadata.totalFrequency,
      averageFrequency: this.metadata.totalFrequency / this.metadata.wordCount,
    };
  }
}

export const BaseTrieNodeSchema = z.object({
  get children() {
    return z.record(z.string(), BaseTrieNodeSchema);
  },
  isEndOfWord: z.boolean(),
});

export const NotWordNodeSchema = z.extend(BaseTrieNodeSchema, {
  isEndOfWord: z.literal(false),
});

export const WordNodeSchema = z.extend(BaseTrieNodeSchema, {
  frequency: z.number(),
  articleCount: z.number(),
  hyphenatedForms: z.array(z.string()),
  isEndOfWord: z.literal(true),
});

export type WordNode = z.infer<typeof WordNodeSchema>;

const TrieNodeSchema = z.discriminatedUnion('isEndOfWord', [
  NotWordNodeSchema,
  WordNodeSchema,
]);

export type TrieNode = z.infer<typeof TrieNodeSchema>;
