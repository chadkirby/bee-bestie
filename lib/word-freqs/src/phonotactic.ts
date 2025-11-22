import nlp from 'compromise';
import plugin from 'compromise-speech';

nlp.extend(plugin);

type Transitions = Record<string, Record<string, number>>;

export class PhonotacticScorer {
  // Character transitions within syllables
  private charTransitions: Transitions = {};
  // Syllable transitions (bigrams)
  private syllableBigrams: Transitions = {};

  // A threshold for what counts as "pronounceable" for a single syllable
  // Tuned for log probabilities
  private threshold: number = -4.0;

  // Hard threshold for any single transition.
  // If a transition is rarer than this (e.g. -6.0), the syllable is rejected immediately.
  private minTransitionThreshold: number = -6.0;

  constructor(words?: string[]) {
    if (words) {
      this.train(words);
    }
  }

  /**
   * Train the model on a list of real English words.
   * This builds:
   * 1. A map of "Likelihood of Char C given Preceding Chars A and B" (within syllables)
   * 2. A map of "Likelihood of Syllable S2 given Syllable S1"
   */
  train(words: string[]) {
    const charCounts: Record<string, Record<string, number>> = {};
    const charTotals: Record<string, number> = {};

    const sylCounts: Record<string, Record<string, number>> = {};
    const sylTotals: Record<string, number> = {};

    for (const word of words) {
      if (/[^a-z]/i.test(word)) continue;
      const doc = nlp(word.toLowerCase());
      // @ts-expect-error compromise-speech adds syllables method
      const syllables: string[] = doc.syllables().flat();

      // 1. Train Character Transitions (per syllable)
      for (const syllable of syllables) {
        const tokenized = `^^${syllable}$$`;
        for (let i = 0; i < tokenized.length - 2; i++) {
          const context = tokenized.slice(i, i + 2);
          const char = tokenized[i + 2]!;

          if (!charCounts[context]) charCounts[context] = {};
          if (!charCounts[context]![char]) charCounts[context]![char] = 0;

          charCounts[context]![char]++;
          charTotals[context] = (charTotals[context] || 0) + 1;
        }
      }

      // 2. Train Syllable Bigrams
      const sylTokenized = ['^^', ...syllables, '$$'];
      for (let i = 0; i < sylTokenized.length - 1; i++) {
        const current = sylTokenized[i]!;
        const next = sylTokenized[i + 1]!;

        if (!sylCounts[current]) sylCounts[current] = {};
        if (!sylCounts[current]![next]) sylCounts[current]![next] = 0;

        sylCounts[current]![next]++;
        sylTotals[current] = (sylTotals[current] || 0) + 1;
      }
    }

    // Convert counts to Log Probabilities
    this.charTransitions = this.countsToLogProbs(charCounts, charTotals);
    this.syllableBigrams = this.countsToLogProbs(sylCounts, sylTotals);
  }

  private countsToLogProbs(
    counts: Record<string, Record<string, number>>,
    totals: Record<string, number>
  ): Transitions {
    // set a threshold to ignore extremely rare transitions
    const minTransitionLogThreshold = -11;
    const transitions: Transitions = {};
    for (const context in counts) {
      transitions[context] = {};
      for (const next in counts[context]) {
        const probability = counts[context]![next]! / totals[context]!;
        const logProb = Math.log(probability);
        if (logProb < minTransitionLogThreshold) continue;
        transitions[context]![next] = logProb;
      }
    }
    return transitions;
  }

  /**
   * Returns a normalized log-probability score for the word.
   * This is the average score of all its syllables.
   */
  score(word: string): number {
    const doc = nlp(word);
    // @ts-expect-error compromise-speech adds syllables method
    const syllables: string[] = doc.syllables().flat();

    if (syllables.length === 0) return -100;

    let totalScore = 0;

    for (const syllable of syllables) {
      totalScore += this.scoreSyllable(syllable);
    }

    return totalScore / syllables.length;
  }

  private scoreSyllable(syllable: string): number {
    const tokenized = `^^${syllable.toLowerCase()}$$`;
    let totalScore = 0;
    let transitionsCount = 0;

    for (let i = 0; i < tokenized.length - 2; i++) {
      const context = tokenized.slice(i, i + 2);
      const char = tokenized[i + 2]!;

      const prob = this.charTransitions[context]?.[char];

      if (prob !== undefined) {
        if (prob < this.minTransitionThreshold) {
          // Hard fail for very rare transitions
          return -10.0;
        }
        totalScore += prob;
      } else {
        // Penalty for impossible transitions within a syllable
        return -10.0;
      }
      transitionsCount++;
    }

    return totalScore / transitionsCount;
  }

  /**
   * Boolean check for viability.
   * A word is viable if ALL its syllables are viable (score > threshold).
   */
  isViable(word: string): boolean {
    const doc = nlp(word);
    // @ts-expect-error compromise-speech adds syllables method
    const syllables: string[] = doc.syllables().flat();

    if (syllables.length === 0) return false;

    for (const syllable of syllables) {
      const score = this.scoreSyllable(syllable);
      if (score <= this.threshold) return false;
    }

    return true;
  }

  /**
   * Generates all "viable" pseudowords using syllable bigrams via DFS.
   * This is exhaustive and deterministic.
   */
  *generateViableWords(options: {
    pool: string;
    center: string;
    minLen?: number;
    maxLen?: number;
  }): Generator<string> {
    const { pool, center, minLen = 4, maxLen = 8 } = options;
    const poolSet = new Set(pool.split(''));
    poolSet.add(center);

    const validLettersPattern = new RegExp(
      `^[${Array.from(poolSet).join('')}^$]+$`
    );

    // Pre-filter transitions to avoid repeated checks?
    // Actually, given the graph size, checking on the fly is probably fine for now.
    // But we can optimize if needed.

    // Stack for DFS: [currentSyllable, currentWordSyllables[]]
    const stack: [string, string[]][] = [['^^', []]];

    const maxAdjacentIdenticalSyllables = 2;

    while (stack.length > 0) {
      const [currentSyllable, currentWordSyllables] = stack.pop()!;
      const currentWord = currentWordSyllables.join('');

      const nextSyllablesMap = this.syllableBigrams[currentSyllable];
      if (!nextSyllablesMap) continue;

      const candidates = Object.keys(nextSyllablesMap).filter((s) =>
        validLettersPattern.test(s)
      );

      for (const next of candidates) {
        if (next === '$$') {
          // Check if word is valid
          if (currentWord.length >= minLen && currentWord.includes(center)) {
            yield currentWord;
          }
          continue;
        }

        if (`${currentWord}${next}`.length > maxLen) continue;
        // Check for too many adjacent identical syllables
        if (
          currentWordSyllables.length >= maxAdjacentIdenticalSyllables &&
          currentWordSyllables
            .slice(-maxAdjacentIdenticalSyllables)
            .every((s) => s === next)
        ) {
          continue;
        }
        stack.push([next, [...currentWordSyllables, next]]);
      }
    }
  }

  countViableWords(options: {
    pool: string;
    center: string;
    minLen?: number;
    maxLen?: number;
  }): number {
    let count = 0;
    for (const _ of this.generateViableWords(options)) {
      count++;
    }
    return count;
  }

  // Helper to export the trained model as JSON
  exportModel(): string {
    return JSON.stringify({
      charTransitions: this.charTransitions,
      syllableBigrams: this.syllableBigrams,
    });
  }

  // Helper to load a pre-trained model
  importModel(data: {
    charTransitions: Transitions;
    syllableBigrams: Transitions;
  }) {
    this.charTransitions = data.charTransitions;
    this.syllableBigrams = data.syllableBigrams;
  }

  static async load() {
    const { default: modelJson } = await import('./phonotactic-model.json', {
      with: { type: 'json' },
    });
    const scorer = new PhonotacticScorer();
    // @ts-expect-error JSON import typing
    scorer.importModel(modelJson);
    return scorer;
  }
}
