import { useEffect, useState, useMemo } from 'react';
import { DateTime } from 'luxon';
import { useParams, useLocation, useNavigate, NavLink } from 'react-router-dom';
import { TabDataService, type WordDetailsResponse } from '@/services/tabDataService';
import { WordTimeline } from '@/components/WordTimeline';

// Helper to check if a word is a pangram (uses all 7 letters)
function isPangram(word: string): boolean {
  return new Set(word).size === 7;
}

// Helper to get Spelling Bee point value for a word
function getPoints(word: string): number {
  const basePoints = word.length === 4 ? 1 : word.length;
  return isPangram(word) ? basePoints + 7 : basePoints;
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
  const points = getPoints(wordDetails.word);

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

        <h1 className="text-4xl font-bold mb-8 capitalize">{wordDetails.word}</h1>

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
                <h3 className="text-lg font-medium mb-4">Puzzle Appearances</h3>
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
                  {/* World Commonality */}
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">World Frequency</span>
                      <span className="text-sm text-gray-500">
                        {(wordDetails.commonality * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-blue-600 h-2.5 rounded-full"
                        style={{ width: `${wordDetails.commonality * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Based on occurrence in Wikipedia corpus
                    </p>
                  </div>

                  {/* SB Commonality */}
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">Spelling Bee Frequency</span>
                      <span className="text-sm text-gray-500">
                        {(wordDetails.sbCommonality * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-yellow-500 h-2.5 rounded-full"
                        style={{ width: `${wordDetails.sbCommonality * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Relative to other Spelling Bee answers
                    </p>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <dl className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                <div>
                  <dt className="text-sm text-gray-600 mb-1">
                    Wikipedia Count
                  </dt>
                  <dd className="text-xl font-bold">
                    {wordDetails.frequency.toLocaleString()}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm text-gray-600 mb-1">Obscurity Score</dt>
                  <dd className="text-xl font-bold">
                    {(wordDetails.obscurity * 100).toFixed(1)}%
                  </dd>
                  <dd className="text-xs text-gray-500 mt-1">
                    Higher = More obscure
                  </dd>
                </div>
              </dl>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
