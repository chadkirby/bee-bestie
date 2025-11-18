#! /usr/bin/env -S node --no-warnings --experimental-transform-types

import { createWriteStream } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { parseArgs } from "node:util";
import { createGzip } from 'node:zlib';
import { pack } from 'msgpackr';
import { mean, median, standardDeviation } from 'simple-statistics';
import type { TrieNode } from '../src/trie.js';
import { WordFreqMetadata } from '../src/word-freq-schemas.js';

// Parse CSV line (handle quoted fields)
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current.replace(/"/g, '').trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.replace(/"/g, '').trim());
  return fields;
}

const { positionals, values } = parseArgs({
  options: {
    help: {
      type: 'boolean',
      short: 'h',
    },
  },
  allowPositionals: true,
});

const wordFreqFile =
  positionals[0] || path.join(import.meta.dirname, 'word_stats.csv');

if (values.help) {
  console.log(`
Usage: node make-trie.ts [word-frequency-file] [options]

Options:
  -h, --help          Show this help message

Example:
  node make-trie.ts word_stats.csv
`);
  process.exit(0);
}

console.log(`Reading word frequency data from: ${wordFreqFile}`);
const rawWordFreqs = await readFile(wordFreqFile, 'utf8');

// Parse the CSV word frequency data
const lines = rawWordFreqs.split('\n').filter((line) => line.trim());
const dataLines = lines.slice(1);

console.log(`Parsing ${dataLines.length} rows...`);

// Create the root of our trie
const root: TrieNode = {
  children: {},
  end: false,
};

const MIN_FREQ = 0;

let wordCount = 0;
let totalFrequency = 0;
let totalArticleCount = 0;
let hyphenatesCount = 0;
const allFrequencies: number[] = [];

// Build the prefix tree
for (const line of dataLines) {
  const fields = parseCSVLine(line);
  const [word, freqStr, articleCountStr, hyphenatesStr] = fields;

  if (!word) continue;

  const frequency = freqStr ? parseInt(freqStr, 10) : 0;
  const articleCount = articleCountStr ? parseInt(articleCountStr, 10) : 0;

  if (Number.isNaN(frequency)) continue;
  if (frequency < MIN_FREQ) continue;

  totalFrequency += frequency;
  totalArticleCount += articleCount;
  wordCount++;
  allFrequencies.push(frequency);

  // normalize accented words
  const normalizedWord = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Insert word into trie
  let currentNode: TrieNode = root;

  for (const char of normalizedWord.toLowerCase()) {
    if (!currentNode.children[char]) {
      currentNode.children[char] = {
        children: {},
        end: false,
      };
    }
    currentNode = currentNode.children[char] as TrieNode;
  }

  // Mark end of word
  currentNode.end = true;
}

// Compute statistics for percentiles, log, rank, z-score
allFrequencies.sort((a, b) => a - b);
const minFrequency = allFrequencies[0] ?? 0;
const maxFrequency = allFrequencies[allFrequencies.length - 1] ?? 0;
const meanFrequency = mean(allFrequencies);
const medianFrequency = median(allFrequencies);
const stddevFrequency = standardDeviation(allFrequencies);

console.log(
  `Trie built with ${wordCount} words and total frequency of ${totalFrequency.toLocaleString()}`
);

const metadata: WordFreqMetadata = {
  wordCount,
  totalFrequency,
  minFrequency,
  maxFrequency,
  meanFrequency,
  medianFrequency,
  stddevFrequency,
  totalArticleCount,
  hyphenatesCount,
};

// Write the serializable trie metadata to JSON file
const metadataPath = path.join(
  import.meta.dirname,
  '../word-stats-metadata.json'
);

await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

console.log(`Metadata written to: ${metadataPath}`);

// Serialize each first-letter child to individual msgpack-ed and gzipped files
const baseDir = path.dirname(wordFreqFile);
const baseName = path.basename(wordFreqFile, path.extname(wordFreqFile));
let filesCreated = 0;
let totalCompressedSize = 0;
const fileStats: Record<string, number> = {};

for (const [key, value] of Object.entries(root.children)) {
  // Create individual file for each first letter
  const subtriePath = path.join(baseDir, `${baseName}-${key}.mpck.gz`);

  // Pack the subtrie node and compress with gzip
  const packedSubtrie = pack(value);
  const gzip = createGzip();
  const source = Readable.from(packedSubtrie);
  const destination = createWriteStream(subtriePath);
  await pipeline(source, gzip, destination);

  filesCreated++;
  const fileSizeMB = packedSubtrie.byteLength / (1024 * 1024);
  totalCompressedSize += fileSizeMB;
  fileStats[key] = fileSizeMB;

  console.log(`Created ${subtriePath} (${fileSizeMB.toFixed(2)} MB)`);
}

console.log(`\nCreated ${filesCreated} individual trie files`);
console.log(`Total uncompressed size: ${totalCompressedSize.toFixed(2)} MB`);
console.log(
  `Average file size: ${(totalCompressedSize / filesCreated).toFixed(2)} MB`
);

// Display detailed file statistics
console.log('\nFile Distribution by First Letter:');
const sortedStats = Object.entries(fileStats).sort(([, a], [, b]) => b - a);
for (const [letter, size] of sortedStats) {
  const percentage = ((size / totalCompressedSize) * 100).toFixed(1);
  console.log(`- ${letter}: ${size.toFixed(2)} KB (${percentage}%)`);
}

console.log(`\nFile Structure:`);
console.log(`- Metadata: ${metadataPath}`);
console.log(`- Individual trie files: ${baseName}-{letter}.mpck.gz`);

// Display comprehensive statistics
console.log('\nTrie Statistics:');
console.log(`- Total words: ${wordCount.toLocaleString()}`);
console.log(`- Total frequency: ${totalFrequency.toLocaleString()}`);
console.log(`- Total article count: ${totalArticleCount.toLocaleString()}`);
console.log(`- Hyphenated forms: ${hyphenatesCount.toLocaleString()}`);
console.log(`- Average frequency: ${(totalFrequency / wordCount).toFixed(2)}`);
console.log(
  `- Average article count: ${(totalArticleCount / wordCount).toFixed(2)}`
);
console.log(`- Min frequency: ${minFrequency.toLocaleString()}`);
console.log(`- Max frequency: ${maxFrequency.toLocaleString()}`);
console.log(`- Median frequency: ${medianFrequency.toFixed(2)}`);
console.log(`- Mean frequency: ${meanFrequency.toFixed(2)}`);
console.log(`- Standard deviation: ${stddevFrequency.toFixed(2)}`);

// Test with a few common words
function findWordInTrie(word: string): TrieNode | null {
  let currentNode: TrieNode | null = root;

  for (const char of word.toLowerCase()) {
    if (!currentNode?.children[char]) {
      return null;
    }
    currentNode = currentNode.children[char] as TrieNode;
  }

  return currentNode?.end ? currentNode : null;
}

// Test with specific words from your CSV
const testWords = ['above', 'scholars', 'highlight', 'state-oriented'];
console.log('\nTesting trie with sample words:');
for (const word of testWords) {
  const node = findWordInTrie(word);
  if (node && node.end) {
    console.log(
      `- "${word}": found in trie (node has ${Object.keys(node.children).length} children)`
    );
  } else {
    console.log(`- "${word}": not found`);
  }
}
