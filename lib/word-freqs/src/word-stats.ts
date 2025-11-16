import type { WordFreqMetadata, WordStats } from './word-freq-schemas.js';

export function getWordStats(
  metadata: WordFreqMetadata,
  frequency: number
): Omit<WordStats, 'word'> {
  // const zscore = this.stddevFrequency > 0 ? (freq - this.meanFrequency) / this.stddevFrequency : 0;
  const probability = frequency / metadata.totalFrequency;
  const commonality = computeCommonalityFromMetadata(metadata, frequency);
  return {
    found: true,
    frequency,
    commonality,
    probability,
  };
}

function computeCommonalityFromMetadata(
  metadata: WordFreqMetadata,
  freq: number
): number {
  const probability = freq / metadata.totalFrequency;
  const maxProbability = metadata.maxFrequency / metadata.totalFrequency;
  const minProbability = metadata.minFrequency / metadata.totalFrequency;

  const commonality = computeCommonality(
    probability,
    minProbability,
    maxProbability
  );
  return commonality;
}

/**
 * Compute the commonality of a probability value within a range.
 *
 * The commonality score is a normalized, de-skewed measure of how frequent a word is in a large corpus. It is calculated as follows:
 *
 * For each word, compute its empirical probability:
 *   probability = (word frequency) / (total frequency of all words)
 *
 * Apply the logit transformation to spread out the high end:
 *   logit(p) = ln(p / (1 - p)), where p is the probability (clamped to avoid 0 or 1)
 *
 * Normalize the logit value to the [0, 1] range using the minimum and maximum logit values across the dataset:
 *   commonality = (logit(p) - minLogit) / (maxLogit - minLogit)
 *
 * This process ensures that:
 *
 * The most common word(s) have a score near 1.
 * The rarest word(s) have a score near 0.
 * The distribution is less skewed, so "normal" words fall in the middle, and the scale is more intuitive for comparison.
 * This approach is robust to the long-tail distribution typical of word frequencies.
 *
 * @param   probability     - The empirical probability of the word
 * @param   minProbability  - The minimum probability in the dataset
 * @param   maxProbability  - The maximum probability in the dataset
 *
 * @return normalized, de-skewed measure of how frequent a word is in a large corpus
 */
export function computeCommonality(
  probability: number,
  minProbability: number,
  maxProbability: number
): number {
  // Apply logit transformation
  const minLogit = logit(minProbability);
  const maxLogit = logit(maxProbability);
  const pLogit = logit(probability);
  const commonality = (pLogit - minLogit) / (maxLogit - minLogit);
  return clamp(commonality, 0, 1);
}

/**
 * Apply the logit transformation to a value.
 *
 * The logit transformation is defined as: logit(p) = ln(p / (1 - p))
 *
 * It is used to transform probabilities into a log-odds space, which
 * can be useful for various statistical analyses.
 */
function logit(x: number): number {
  x = clamp(x);
  return Math.log(x / (1 - x));
}

// Clamp to avoid infinity
const eps = 1e-9;

/**
 * Clamp a value to a given range.
 */
function clamp(value: number, min = eps, max = 1 - eps): number {
  return Math.min(Math.max(value, min), max);
}
