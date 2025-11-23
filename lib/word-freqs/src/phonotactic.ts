import nlp from 'compromise';
import plugin from 'compromise-speech';

nlp.extend(plugin);

type Transitions = Record<string, Record<string, number>>;

type ModelData = {
  charTransitions: Transitions;
  syllableBigrams: Transitions;
};

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

    // 1. Pre-compute valid transitions
    // Map<currentSyllable, validNextSyllables[]>
    const validTransitions = new Map<string, string[]>();

    // Helper to check if a syllable is valid for this pool
    const isValidSyllable = (s: string) => {
      if (s === '$$') return true;
      for (const char of s) {
        if (!poolSet.has(char)) return false;
      }
      return true;
    };

    for (const [current, nextMap] of Object.entries(this.syllableBigrams)) {
      // We only care about 'current' if it's valid (or start token)
      if (current !== '^^' && !isValidSyllable(current)) continue;

      const validNext: string[] = [];
      for (const next of Object.keys(nextMap)) {
        if (isValidSyllable(next)) {
          validNext.push(next);
        }
      }
      if (validNext.length > 0) {
        validTransitions.set(current, validNext);
      }
    }

    // Stack for DFS: [currentSyllable, currentLength, hasCenter, syllableList]
    // We track length numerically to avoid joining strings constantly.
    // We track hasCenter boolean to avoid checking it at the end.
    const stack: [string, number, boolean, string[]][] = [['^^', 0, false, []]];

    const maxAdjacentIdenticalSyllables = 2;

    while (stack.length > 0) {
      const [currentSyllable, currentLen, hasCenter, currentWordSyllables] =
        stack.pop()!;

      const candidates = validTransitions.get(currentSyllable);
      if (!candidates) continue;

      for (const next of candidates) {
        if (next === '$$') {
          // Check if word is valid
          if (currentLen >= minLen && hasCenter) {
            yield currentWordSyllables.join('');
          }
          continue;
        }

        const nextLen = currentLen + next.length;
        if (nextLen > maxLen) continue;

        // Check for too many adjacent identical syllables
        if (
          currentWordSyllables.length >= maxAdjacentIdenticalSyllables &&
          currentWordSyllables[currentWordSyllables.length - 1] === next &&
          currentWordSyllables[currentWordSyllables.length - 2] === next
        ) {
          continue;
        }

        const nextHasCenter = hasCenter || next.includes(center);
        stack.push([
          next,
          nextLen,
          nextHasCenter,
          [...currentWordSyllables, next],
        ]);
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

  countValidSyllables(pool: string): number {
    const poolSet = new Set(pool.split(''));
    const isValid = (s: string) => {
      if (s === '^^' || s === '$$') return false;
      for (const char of s) {
        if (!poolSet.has(char)) return false;
      }
      return true;
    };

    const syllables = new Set<string>();
    for (const [current, nextMap] of Object.entries(this.syllableBigrams)) {
      if (isValid(current)) syllables.add(current);
      for (const next of Object.keys(nextMap)) {
        if (isValid(next)) syllables.add(next);
      }
    }
    return syllables.size;
  }

  /**
   * Generates a single random viable word.
   * Uses a randomized walk on the syllable graph.
   * Retries up to `maxRetries` times if it hits a dead end or invalid word.
   */
  /**
   * Generates a single random viable word.
   * Uses a randomized walk on the syllable graph.
   * Retries up to `maxRetries` times if it hits a dead end or invalid word.
   */
  getRandomViableWord(options: {
    pool: string;
    center: string;
    minLen?: number;
    maxLen?: number;
    maxRetries?: number;
  }): string | null {
    const { pool, center, minLen = 4, maxLen = 8, maxRetries = 50 } = options;
    const poolSet = new Set(pool.split(''));
    poolSet.add(center);

    const isValidSyllable = (s: string) => {
      if (s === '$$' || s === '^^') return true;
      for (const char of s) {
        if (!poolSet.has(char)) return false;
      }
      return true;
    };

    // 1. Build Transition Maps (Forward & Backward)
    const validTransitions = new Map<string, string[]>();
    const validReverseTransitions = new Map<string, string[]>();
    const anchorSyllables: string[] = [];

    // We need to include '^^' in valid syllables for the graph structure,
    // but we don't want to pick it as a seed.
    const validSyllables = new Set<string>();

    for (const [current, nextMap] of Object.entries(this.syllableBigrams)) {
      if (!isValidSyllable(current)) continue;
      validSyllables.add(current);

      if (current !== '^^' && current !== '$$' && current.includes(center)) {
        anchorSyllables.push(current);
      }

      for (const next of Object.keys(nextMap)) {
        if (!isValidSyllable(next)) continue;
        validSyllables.add(next);

        // Forward
        if (!validTransitions.has(current)) validTransitions.set(current, []);
        validTransitions.get(current)!.push(next);

        // Backward
        if (!validReverseTransitions.has(next))
          validReverseTransitions.set(next, []);
        validReverseTransitions.get(next)!.push(current);
      }
    }

    // If no anchors, we can't enforce the center letter constraint easily with this method
    // unless we just pick *any* valid syllable and hope.
    // But for Spelling Bee, we MUST have the center letter.
    if (anchorSyllables.length === 0) return null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // 2. Pick a random seed syllable that contains the center letter
      const seed =
        anchorSyllables[Math.floor(Math.random() * anchorSyllables.length)];
      if (!seed) continue;

      // 3. Walk Backwards to '^^'
      let prefixParts: string[] = [];
      let currentBack = seed;
      let failedBack = false;

      // Safety break for infinite loops (though graph should be acyclic-ish for valid words, cycles exist)
      let backSteps = 0;
      while (currentBack !== '^^') {
        const prevCandidates = validReverseTransitions.get(currentBack);
        if (!prevCandidates || prevCandidates.length === 0) {
          failedBack = true;
          break;
        }
        const prev =
          prevCandidates[Math.floor(Math.random() * prevCandidates.length)];
        if (!prev) {
          failedBack = true;
          break;
        }
        if (prev !== '^^') {
          prefixParts.unshift(prev);
        }
        currentBack = prev;

        backSteps++;
        if (backSteps > 10) {
          failedBack = true;
          break;
        } // Arbitrary limit to prevent infinite loops
      }

      if (failedBack) continue;

      // 4. Walk Forwards to '$$'
      let suffixParts: string[] = [];
      let currentFwd = seed;
      let failedFwd = false;
      let fwdSteps = 0;

      while (currentFwd !== '$$') {
        const nextCandidates = validTransitions.get(currentFwd);
        if (!nextCandidates || nextCandidates.length === 0) {
          failedFwd = true;
          break;
        }
        const next =
          nextCandidates[Math.floor(Math.random() * nextCandidates.length)];
        if (!next) {
          failedFwd = true;
          break;
        }
        if (next !== '$$') {
          suffixParts.push(next);
        }
        currentFwd = next;

        fwdSteps++;
        if (fwdSteps > 10) {
          failedFwd = true;
          break;
        }
      }

      if (failedFwd) continue;

      // 5. Construct Word
      const fullWordSyllables = [...prefixParts, seed, ...suffixParts];
      const word = fullWordSyllables.join('');

      // 6. Validate Constraints
      if (word.length < minLen || word.length > maxLen) continue;

      // Check for adjacent identical syllables
      let hasTooManyRepeats = false;
      for (let i = 0; i < fullWordSyllables.length - 1; i++) {
        if (fullWordSyllables[i] === fullWordSyllables[i + 1]) {
          // allow 2 adjacent identical syllables, but not 3. This is the "tartar" rule.
          // "Tartar" is allowed, but not "tartartar".
          if (
            i + 2 < fullWordSyllables.length &&
            fullWordSyllables[i + 2] === fullWordSyllables[i]
          ) {
            hasTooManyRepeats = true;
            break;
          }
        }
      }
      if (hasTooManyRepeats) continue;

      return word;
    }

    return null;
  }

  /**
   * Returns a subset of the model containing only transitions relevant to the given pool.
   */
  filterModel(pool: string): {
    charTransitions: Transitions;
    syllableBigrams: Transitions;
  } {
    const poolSet = new Set(pool.split(''));
    const isValid = (s: string) => {
      if (s === '^^' || s === '$$') return true;
      for (const char of s) {
        if (!poolSet.has(char)) return false;
      }
      return true;
    };

    const filteredCharTransitions: Transitions = {};
    for (const [context, nextMap] of Object.entries(this.charTransitions)) {
      // Context must be valid (except ^^ start markers which might contain non-pool chars in theory,
      // but here context is within a syllable, so it should be valid)
      // Actually, charTransitions context includes '^^'.
      // Let's just check if all chars in context are in pool (ignoring ^^)
      if (!isValid(context.replace(/\^\^/g, ''))) continue;

      const filteredNext: Record<string, number> = {};
      for (const [char, prob] of Object.entries(nextMap)) {
        if (isValid(char)) {
          filteredNext[char] = prob;
        }
      }
      if (Object.keys(filteredNext).length > 0) {
        filteredCharTransitions[context] = filteredNext;
      }
    }

    const filteredSyllableBigrams: Transitions = {};
    for (const [current, nextMap] of Object.entries(this.syllableBigrams)) {
      if (!isValid(current)) continue;

      const filteredNext: Record<string, number> = {};
      for (const [next, prob] of Object.entries(nextMap)) {
        if (isValid(next)) {
          filteredNext[next] = prob;
        }
      }
      if (Object.keys(filteredNext).length > 0) {
        filteredSyllableBigrams[current] = filteredNext;
      }
    }

    return {
      charTransitions: filteredCharTransitions,
      syllableBigrams: filteredSyllableBigrams,
    };
  }

  // Helper to export the trained model as JSON
  exportModel(): string {
    return JSON.stringify({
      charTransitions: this.charTransitions,
      syllableBigrams: this.syllableBigrams,
    });
  }

  // Helper to load a pre-trained model
  importModel(data: ModelData) {
    this.charTransitions = data.charTransitions;
    this.syllableBigrams = data.syllableBigrams;
  }

  static async load() {
    const { default: modelJson } = await import('./phonotactic-model.json', {
      with: { type: 'json' },
    });
    const scorer = new PhonotacticScorer();
    scorer.importModel(modelJson as ModelData);
    return scorer;
  }
}
