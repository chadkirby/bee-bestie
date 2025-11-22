export default `
-- Migration script for bee-puzzles database
-- Run with: npx wrangler d1 execute bee-puzzles --file=workers/initialization/migration.sql

-- Create puzzles table
CREATE TABLE IF NOT EXISTS puzzles (
  date TEXT PRIMARY KEY,  -- ISO date string (YYYY-MM-DD)
  centerLetter TEXT NOT NULL,
  outerLetters TEXT NOT NULL -- JSON array of 6 letters
);

-- Create word_dates table for reverse lookups
CREATE TABLE IF NOT EXISTS word_dates (
  word TEXT NOT NULL,
  date TEXT NOT NULL,
  PRIMARY KEY (word, date),
  FOREIGN KEY (date) REFERENCES puzzles(date)
);

-- Create hyphenates table for hyphenated word variants
CREATE TABLE IF NOT EXISTS hyphenates (
  word TEXT NOT NULL,
  hyphenated_form TEXT NOT NULL,
  PRIMARY KEY (word, hyphenated_form)
);

-- Create word_frequencies table for word frequency data
CREATE TABLE IF NOT EXISTS word_frequencies (
  word TEXT PRIMARY KEY,
  frequency INTEGER NOT NULL,
  articleCount INTEGER NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_word_dates_word ON word_dates(word);
CREATE INDEX IF NOT EXISTS idx_word_dates_date ON word_dates(date);
CREATE INDEX IF NOT EXISTS idx_hyphenates_word ON hyphenates(word);
CREATE INDEX IF NOT EXISTS idx_word_frequencies_frequency ON word_frequencies(frequency);
`;
