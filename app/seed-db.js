import fs from 'node:fs';
import path from 'node:path';

// Read and parse games.jsonl
const gamesPath = path.join(import.meta.dirname, '..', 'games.jsonl');
const gamesData = fs.readFileSync(gamesPath, 'utf-8')
  .split('\n')
  .filter(line => line.trim())
  .map(line => JSON.parse(line));

console.log(`Found ${gamesData.length} games to process`);

// Generate SQL insert statements
const puzzleInserts = [];
const wordDateInserts = [];

gamesData.forEach(game => {
  // Insert puzzle
  puzzleInserts.push(`INSERT OR REPLACE INTO puzzles (date, centerLetter, outerLetters) VALUES ('${game.date}', '${game.centerLetter}', '${JSON.stringify(game.outerLetters)}');`);

  // Insert word-to-date mappings
  game.answers.forEach(word => {
    wordDateInserts.push(`INSERT OR IGNORE INTO word_dates (word, date) VALUES ('${word.toLowerCase()}', '${game.date}');`);
  });
});

// Write to SQL file
const sqlContent = [
  '-- Auto-generated seeding script',
  '-- Run with: npx wrangler d1 execute bee-puzzles --file=app/seed-db.sql',
  '',
  ...puzzleInserts,
  '',
  ...wordDateInserts
].join('\n');

fs.writeFileSync(path.join(import.meta.dirname, 'seed-db.sql'), sqlContent);

console.log(`Generated SQL file with ${puzzleInserts.length} puzzle inserts and ${wordDateInserts.length} word-date mappings`);
console.log('Run: npx wrangler d1 execute bee-puzzles --file=app/seed-db.sql');
