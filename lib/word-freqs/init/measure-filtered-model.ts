import { PhonotacticScorer } from '../src/phonotactic.js';

const scorer = await PhonotacticScorer.load();

// Sample pool (pangram-ish)
const pool = 'abcdefg';
console.log(`Filtering model for pool: "${pool}"`);

const filtered = scorer.filterModel(pool);

const json = JSON.stringify(filtered);
const sizeBytes = Buffer.byteLength(json, 'utf8');
const sizeKB = sizeBytes / 1024;

console.log(`Original Model Size: ~5.6 MB`);
console.log(`Filtered Model Size: ${sizeKB.toFixed(2)} KB`);
console.log(`Reduction: ${(100 * (1 - sizeBytes / (5.6 * 1024 * 1024))).toFixed(2)}%`);
