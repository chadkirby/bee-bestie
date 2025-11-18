import { unpack } from 'msgpackr';
import { createGunzip } from 'node:zlib';
import { z } from 'zod/mini';
import type { Loader } from './word-freq-schemas.js';
import { wordFreqMetadata } from './word-stats.js';

export class WordFreqTrie {
  private roots: Record<string, TrieNode> = {};

  constructor(private readonly loader: Loader) {}

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
  ): Promise<string[]> {
    // Results array to collect valid words
    const results: Array<{
      word: string;
      node: TrieNode;
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
      if (prefix.length >= minLength && node.end) {
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
    return results.map(({ word }) => word);
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
      end: false,
    };
  }

  // Find a word in the trie
  async has(word: string): Promise<boolean> {
    if (!word[0]) {
      return false;
    }

    let current = await this.getRoot(word[0]);
    if (!current) {
      return false;
    }

    for (const char of word.toLowerCase()) {
      if (!current.children[char]) {
        return false;
      }
      current = current.children[char] as TrieNode;
    }

    if (current.end) {
      return true;
    }
    return false;
  }

  // Get all words with a given prefix
  async getWordsWithPrefix(prefix: string): Promise<string[]> {
    const results: string[] = [];
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

  private collectWords(node: TrieNode, prefix: string, results: Array<string>) {
    if (node.end) {
      results.push(prefix);
    }

    for (const [char, childNode] of Object.entries(node.children)) {
      this.collectWords(childNode as TrieNode, prefix + char, results);
    }
  }

  // Get statistics
  getStats() {
    return {
      wordCount: wordFreqMetadata.wordCount,
      totalFrequency: wordFreqMetadata.totalFrequency,
      averageFrequency:
        wordFreqMetadata.totalFrequency / wordFreqMetadata.wordCount,
    };
  }
}

export const TrieNodeSchema = z.object({
  get children() {
    return z.record(z.string(), TrieNodeSchema);
  },
  end: z.boolean(),
});

export type TrieNode = z.infer<typeof TrieNodeSchema>;
