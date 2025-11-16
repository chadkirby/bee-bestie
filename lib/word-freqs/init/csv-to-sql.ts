#!/usr/bin/env node

// CSV to D1 Database Importer
// This script parses the word-freqs CSV file and imports data into D1 tables

import fs from 'fs';
import path from 'path';

// Define interfaces for our data structures
interface WordData {
  word: string;
  frequency: number;
  articleCount: number;
  hyphenates: string[];
}

// CSV parsing function
function parseCSV(csvContent: string): WordData[] {
  const lines = csvContent.trim().split('\n');
  const data: WordData[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted fields that may contain commas
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
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

    // Extract data (assuming order: word, frequency, articleCount, hyphenates)
    const word = fields[0] || '';
    const frequency = fields[1] ? parseInt(fields[1], 10) : 0;
    const articleCount = fields[2] ? parseInt(fields[2], 10) : 0;
    const hyphenatesStr = fields[3] || '';

    // Skip empty words
    if (!word) continue;

    // Parse hyphenated forms
    const hyphenates = hyphenatesStr
      ? hyphenatesStr
          .split(';')
          .map((form) => form.trim())
          .filter(Boolean)
      : [];

    data.push({
      word,
      frequency,
      articleCount,
      hyphenates,
    });
  }

  return data;
}

// Generate SQL INSERT statements
function generateInsertSQL(data: WordData[]): {
  hyphenates: string;
  frequencies: string;
} {
  const hyphenatesInserts: string[] = [];
  const frequenciesInserts: string[] = [];

  data.forEach((row) => {
    // Escape single quotes in strings
    const escapedWord = row.word.replace(/'/g, "''");

    // Add frequency data
    frequenciesInserts.push(
      `INSERT OR REPLACE INTO word_frequencies (word, frequency, articleCount) VALUES ('${escapedWord}', ${row.frequency}, ${row.articleCount});`
    );

    // Process hyphenated forms
    row.hyphenates.forEach((form) => {
      const escapedForm = form.replace(/'/g, "''");
      hyphenatesInserts.push(
        `INSERT OR IGNORE INTO hyphenates (word, hyphenated_form) VALUES ('${escapedWord}', '${escapedForm}');`
      );
    });
  });

  return {
    hyphenates: hyphenatesInserts.join('\n'),
    frequencies: frequenciesInserts.join('\n'),
  };
}

const scriptDir = new URL('.', import.meta.url).pathname;
const csvPath = path.join(scriptDir, 'word_stats.csv');
const outputPath = path.join(scriptDir, 'insert-data.sql');

try {
  console.log('Reading CSV file...');
  const csvContent = fs.readFileSync(csvPath, 'utf8');

  console.log('Parsing CSV data...');
  const data = parseCSV(csvContent);
  console.log(`Parsed ${data.length} rows`);

  console.log('Generating SQL INSERT statements...');
  const sql = generateInsertSQL(data);

  // Generate complete SQL script
  const insertSQL = `-- Word Frequency Data Insert Script
-- Generated from word_stats.csv
-- Run this after migration.sql to populate the database

-- Insert hyphenated forms
${sql.hyphenates}

-- Insert frequency data
${sql.frequencies}
`;

  fs.writeFileSync(outputPath, insertSQL, 'utf8');
  console.log(`SQL insert script written to: ${outputPath}`);
  console.log(
    `Total hyphenates entries: ${sql.hyphenates.split('\n').filter((line) => line.trim()).length}`
  );
  console.log(
    `Total frequency entries: ${sql.frequencies.split('\n').filter((line) => line.trim()).length}`
  );
} catch (error) {
  console.error(
    'Error processing CSV:',
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
}
