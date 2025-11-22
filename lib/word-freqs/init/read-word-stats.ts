import fs from 'node:fs/promises';
import path from 'node:path';

const CSV_PATH = path.join(import.meta.dirname, 'word_stats.csv');

export type WordStat = {
  word: string;
  frequency: number;
  articleCount: number;
  hyphenates: string[];
};

export type FilterFn = (word: WordStat, index: number) => boolean;


/** a streaming version of readWordStats that returns an async generator */
export async function* streamWordStats(filterFn: FilterFn = (x) => x.frequency > 5) {
  const content = await fs.readFile(CSV_PATH, 'utf-8');
  const lines = content.split('\n');

  // Start from 1 to skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // CSV format: word,frequency,articleCount,hyphenates
    // Some words might be quoted e.g. "word"
    const parts = line.split(',');
    if (!parts[0]) continue;
    const wordStat = {
      word: parts[0].replace(/^"|"$/g, ''),
      frequency: Number(parts[1]),
      articleCount: Number(parts[2]),
      hyphenates: parts[3].replace(/^"|"$/g, '').split(';'),
    };
    if (!filterFn(wordStat, i - 1)) continue;

    yield wordStat;
  }
}

export async function readWordStats(filterFn: FilterFn = (x) => x.frequency > 5) {
  const words: WordStat[] = [];
  for await (const word of streamWordStats(filterFn)) {
    words.push(word);
  }
  return words;
}
