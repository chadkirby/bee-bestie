import nlp from 'compromise';
import plugin from 'compromise-speech';
nlp.extend(plugin);

import { streamWordStats } from './read-word-stats.js';

const syllableSet: Set<string> = new Set();

for await (const word of streamWordStats((x) => x.frequency > 4)) {
  const doc = nlp(word.word);
  // @ts-expect-error doc.syllables() returns string[][]
  for (const syllable of doc.syllables().flat()) {
    syllableSet.add(syllable);
  }
  // count how many adjacent IDENTICAL syllables there are. E.g. "tartar" has 2 adjacent IDENTICAL "tar" syllables
  let maxAdjacentIdenticalSyllables = 0;
  let currentAdjacentIdenticalCount = 0;
  let lastSyllable: string | null = null;
  // @ts-expect-error doc.syllables() returns string[][]
  for (const syllable of doc.syllables().flat()) {
    if (syllable === lastSyllable) {
      currentAdjacentIdenticalCount++;
      maxAdjacentIdenticalSyllables = Math.max(
        maxAdjacentIdenticalSyllables,
        currentAdjacentIdenticalCount
      );
    } else {
      currentAdjacentIdenticalCount = 0;
    }
    lastSyllable = syllable;
  }
  if (maxAdjacentIdenticalSyllables > 2) {
    console.log(word.word, maxAdjacentIdenticalSyllables);
  }
}

console.log(syllableSet.size);
