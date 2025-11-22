import fs from 'node:fs/promises';
import path from 'node:path';
import { PhonotacticScorer } from '../src/phonotactic.js';
import { readWordStats } from './read-word-stats.js';

const OUTPUT_PATH = path.join(
  import.meta.dirname,
  '../src/phonotactic-model.json'
);

const words = await readWordStats((x) => x.frequency > 4);

console.log(`Loaded ${words.length} words.`);
console.log('Training PhonotacticScorer...');

const scorer = new PhonotacticScorer(words.map((x) => x.word));
const modelJson = scorer.exportModel();

console.log(`Saving model to ${OUTPUT_PATH}...`);
await fs.writeFile(OUTPUT_PATH, modelJson);

console.log('Done!');
