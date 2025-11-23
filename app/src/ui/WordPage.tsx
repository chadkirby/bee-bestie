import { useEffect, useState, useMemo } from 'react';
import { DateTime } from 'luxon';
import { useParams, useLocation, useNavigate, NavLink } from 'react-router-dom';
import { TabDataService, type WordDetailsResponse } from '@/services/tabDataService';

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
                <h3 className="text-lg font-medium mb-2">Puzzle Appearances</h3>
                <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
                  {wordDetails.spellingBeeOccurrences.map((occ) => (
                    <div
                      key={occ.date}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
                    >
                      <NavLink
                        to={`/puzzle/${occ.date}/words`}
                        state={{ fromWord: wordDetails.word }}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {DateTime.fromISO(occ.date).toFormat('LLLL d, yyyy')}
                      </NavLink>
                      <span className="text-gray-600 font-mono text-sm">
                        {occ.centerLetter}/{occ.outerLetters.join('')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Linguistic Metrics */}
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold mb-4">Linguistic Metrics</h2>
            <dl className="grid gap-4">
              <div>
                <dt className="text-sm text-gray-600 mb-1">
                  Phonotactic Score (word-likeness)
                </dt>
                <dd className="text-xl font-bold">
                  {wordDetails.phonotacticScore.toFixed(3)}
                </dd>
                <dd className="text-sm text-gray-500 mt-1">
                  Higher scores indicate more typical English phonotactic patterns
                </dd>
              </div>

              <div>
                <dt className="text-sm text-gray-600 mb-1">
                  Wikipedia Frequency (count)
                </dt>
                <dd className="text-xl font-bold">
                  {wordDetails.frequency.toLocaleString()}
                </dd>
                <dd className="text-sm text-gray-500 mt-1">
                  Number of occurrences in Wikipedia corpus
                </dd>
              </div>

              <div>
                <dt className="text-sm text-gray-600 mb-1">Commonality</dt>
                <dd className="text-xl font-bold">
                  {(wordDetails.commonality * 100).toFixed(2)}%
                </dd>
                <dd className="text-sm text-gray-500 mt-1">
                  Relative frequency compared to all words (0-100%)
                </dd>
              </div>

              <div>
                <dt className="text-sm text-gray-600 mb-1">Obscurity</dt>
                <dd className="text-xl font-bold">
                  {(wordDetails.obscurity * 100).toFixed(2)}%
                </dd>
                <dd className="text-sm text-gray-500 mt-1">
                  Inverse of commonality (higher = more obscure)
                </dd>
              </div>

              <div>
                <dt className="text-sm text-gray-600 mb-1">Probability</dt>
                <dd className="text-xl font-bold">
                  {wordDetails.probability.toExponential(3)}
                </dd>
                <dd className="text-sm text-gray-500 mt-1">
                  Probability of occurrence in Wikipedia corpus
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
