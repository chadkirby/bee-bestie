import { useEffect, useState, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { TabDataService, type WordDetailsResponse } from '@/services/tabDataService';
import { WordTimeline } from '@/components/WordTimeline';
import { getBeeScore } from '@/lib/utils.ts';

/**
 * Humanizes a number by rounding to thousandsK or millionsM
 */
function humanize(number: number): string {
  if (number >= 1000000) {
    return (number / 1000000).toFixed(1) + 'M';
  } else if (number >= 1000) {
    return (number / 1000).toFixed(1) + 'K';
  }
  return number.toString();
}

export default function WordPage() {
  const { word } = useParams<{ word: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [wordDetails, setWordDetails] = useState<WordDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track if we came from a puzzle page for back navigation
  const referrerPuzzle = useMemo(() => {
    const state = location.state as { fromPuzzle?: string } | null;
    if (state?.fromPuzzle) return state.fromPuzzle;

    // Try to detect from document.referrer
    if (document.referrer) {
      const match = document.referrer.match(/\/puzzle\/([^/]+)/);
      if (match) return match[1];
    }
    return null;
  }, [location.state]);

  useEffect(() => {
    if (!word) return;

    const abortController = new AbortController();
    setLoading(true);
    setError(null);

    TabDataService.fetchWordDetails(word, abortController.signal)
      .then((data) => {
        setWordDetails(data);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Failed to load word details');
          setLoading(false);
        }
      });

    return () => abortController.abort();
  }, [word]);

  if (!word) return null;

  if (loading) {
    return (
      <div className="app">
        <div className="mx-auto max-w-4xl px-4 py-8">
          {/* Title skeleton */}
          <div className="h-10 w-48 bg-gray-200 rounded animate-pulse mb-8"></div>

          <div className="grid gap-6">
            {/* Spelling Bee Statistics skeleton */}
            <div className="bg-white rounded-lg shadow p-6 space-y-4 animate-pulse">
              <div className="h-8 w-64 bg-gray-200 rounded"></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="h-4 w-32 bg-gray-200 rounded"></div>
                  <div className="h-8 w-16 bg-gray-200 rounded"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-24 bg-gray-200 rounded"></div>
                  <div className="h-8 w-12 bg-gray-200 rounded"></div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-6 w-40 bg-gray-200 rounded"></div>
                <div className="space-y-2">
                  <div className="h-12 bg-gray-100 rounded"></div>
                  <div className="h-12 bg-gray-100 rounded"></div>
                  <div className="h-12 bg-gray-100 rounded"></div>
                </div>
              </div>
            </div>

            {/* Linguistic Metrics skeleton */}
            <div className="bg-white rounded-lg shadow p-6 space-y-4 animate-pulse">
              <div className="h-8 w-48 bg-gray-200 rounded"></div>
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 w-48 bg-gray-200 rounded"></div>
                    <div className="h-6 w-24 bg-gray-200 rounded"></div>
                    <div className="h-3 w-64 bg-gray-100 rounded"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <h1 className="text-3xl font-bold mb-4">Error</h1>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!wordDetails) return null;

  // Calculate points using helper function
  const points = getBeeScore(wordDetails.word);

  return (
    <div className="app">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {referrerPuzzle && (
          <button
            onClick={() => navigate(-1)}
            className="mb-4 text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
          >
            ← Back to puzzle
          </button>
        )}

        <h1 className="text-4xl font-bold mb-8 uppercase">{wordDetails.word}</h1>

        <div className="grid gap-6">
          {/* Spelling Bee Statistics */}
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold mb-4">Spelling Bee Statistics</h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <div className="text-sm text-gray-600">Total Occurrences</div>
                <div className="text-2xl font-bold">
                  {wordDetails.spellingBeeOccurrences.length}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Point Value</div>
                <div className="text-2xl font-bold">{points}</div>
              </div>
            </div>

            {wordDetails.spellingBeeOccurrences.length > 0 && (
              <div>
                <h3 className="text-lg font-medium mb-4">Puzzle Appearances </h3>
                <WordTimeline
                  occurrences={wordDetails.spellingBeeOccurrences}
                  word={wordDetails.word}
                />
              </div>
            )}
          </section>

          {/* Linguistic Metrics */}
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold mb-6">Linguistic Metrics</h2>

            <div className="space-y-8">
              {/* Commonality Comparison */}
              <div>
                <h3 className="text-lg font-medium mb-4">Frequency Comparison</h3>
                <div className="space-y-6">
                  {/* SB Commonality */}
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">Spelling Bee Frequency</span>
                      <span className="text-sm text-gray-500">
                        {(wordDetails.sbCommonality * 100).toFixed(1)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-yellow-500 h-2.5 rounded-full"
                        style={{ width: `${wordDetails.sbCommonality * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {wordDetails.word.toUpperCase()} has been a Spelling Bee answer {humanize(wordDetails.spellingBeeOccurrences.length)} times among {humanize(wordDetails.totalSbFrequency)} total answers.
                    </p>
                  </div>

                  {/* World Commonality */}
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">World Frequency</span>
                      <span className="text-sm text-gray-500">
                        {(wordDetails.commonality * 100).toFixed(1)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-blue-600 h-2.5 rounded-full"
                        style={{ width: `${wordDetails.commonality * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {wordDetails.word.toUpperCase()} appears {humanize(wordDetails.frequency)} times among {humanize(wordDetails.totalWikipediaFrequency)} words in a 2025 Wikipedia corpus.
                    </p>
                  </div>


                </div>
              </div>

              {/* Methodology Note */}
              <div className="pt-4 border-t border-gray-100">
                <h4 className="text-sm font-medium text-gray-700 mb-2">About Commonality Scores</h4>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Commonality scores are derived by normalizing the word's frequency on a logarithmic scale from 0 to 100.
                  This helps compare frequencies across vastly different datasets (like Wikipedia vs. Spelling Bee) by focusing on relative rarity rather than raw counts.
                  A score of 100 means it's the most common word in that dataset, while 0 means it's the rarest.
                </p>
              </div>
            </div>
          </section>

          {/* Hyphenated Forms */}
          {wordDetails.hyphenates.length > 0 && (
            <section className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-semibold mb-6">Hyphenated Forms</h2>
              <p className="text-sm text-gray-600 mb-6">
                This word appears in the Wikipedia corpus as part of the following hyphenated words.
                The frequency bars show how common each hyphenated form is relative to other words.
              </p>

              <div className="space-y-6">
                {wordDetails.hyphenates.map((h) => (
                  <div key={h.form}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{h.form}</span>
                      <span className="text-sm text-gray-500">
                        {(h.commonality * 100).toFixed(1)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-blue-400 h-2.5 rounded-full"
                        style={{ width: `${h.commonality * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Appears {humanize(h.frequency)} times.{' '}
                      <span className="font-medium capitalize">{h.form}</span> is{' '}
                      {h.frequency >= wordDetails.frequency
                        ? (h.frequency / wordDetails.frequency).toFixed(1)
                        : (wordDetails.frequency / h.frequency).toFixed(1)}{' '}
                      times {h.frequency >= wordDetails.frequency ? 'more' : 'less'} common than{' '}
                      <span className="font-medium">{wordDetails.word}</span>.
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
