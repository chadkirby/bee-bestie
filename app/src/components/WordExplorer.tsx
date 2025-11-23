import { useMemo } from 'react';
import { DateTime } from 'luxon';
import { AnswerItem } from '@/components/AnswerItem';
import { Badge } from '@/components/ui/badge';
import type { ExposureConfig } from '@/ui/types';

export type WordStatsRecord = {
  word: string;
  score: number;
  found: boolean;
  frequency: number;
  commonality: number;
  // `probability` exists on the backend schema but we intentionally
  // ignore it in the UI for now.
  probability: number;
  /** All historical puzzle dates where this word appeared, before the current puzzle. */
  sbHistory: string[];
};

// Basic word record for progressive loading (no stats yet)
export type BasicWordRecord = {
  word: string;
  score: number;
  hasStats: false;
};

// Union type for progressive word records
export type WordRecord = WordStatsRecord | BasicWordRecord;

// Sorting by score
export type SortKey = 'score' | 'frequency' | 'obscurity' | 'sbCount' | 'lastSeen' | 'word';

// Type-safe configuration for sort options and display headers
export interface SortConfig {
  key: SortKey;
  label: string;
  getValue: (stat: WordRecord, puzzleDateIso: string) => string | number;
}

export const SORT_CONFIGS: SortConfig[] = [
  {
    key: 'score',
    label: 'Points',
    getValue: (stat) => stat.score,
  },
  {
    key: 'frequency',
    label: 'Count (wiki)',
    getValue: (stat) => ('frequency' in stat) ? stat.frequency.toLocaleString() : '--',
  },
  {
    key: 'obscurity',
    label: 'Obscurity (wiki)',
    getValue: (stat) => ('commonality' in stat) ? (1 - stat.commonality).toFixed(3) : '--',
  },
  {
    key: 'sbCount',
    label: 'Count (SB)',
    getValue: (stat) => ('sbHistory' in stat) ? stat.sbHistory.length : '--',
  },
  {
    key: 'lastSeen',
    label: 'Last seen (SB)',
    getValue: (stat, puzzleDateIso) => ('sbHistory' in stat) ? formatLastSeen(puzzleDateIso, stat.sbHistory) : '--',
  },
] as const;

interface WordExplorerProps {
  stats: WordRecord[];
  lettersToExpose: ExposureConfig;
  /** ISO date string for the current puzzle (YYYY-MM-DD). */
  puzzleDateIso: string;
  sortBy: SortKey;
  sortDirection: 'asc' | 'desc';
  loadingWordStats?: boolean;
}

function formatLastSeen(puzzleDateIso: string, dates: string[]): string {
  if (!dates.length) return '—';

  const puzzle = DateTime.fromISO(puzzleDateIso);
  const lastDateStr = dates[dates.length - 1];
  const last = DateTime.fromISO(lastDateStr);

  if (!puzzle.isValid || !last.isValid) return lastDateStr;

  const days = puzzle.diff(last, 'days').days ?? 0;
  if (days < 1) return '<1 day ago';

  if (days < 7) {
    const d = Math.round(days);
    return `${d} day${d === 1 ? '' : 's'} ago`;
  }

  const weeks = Math.round(days / 7);
  if (weeks < 4) {
    return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  }

  const months = Math.round(days / 30);
  if (months < 12) {
    return `${months} month${months === 1 ? '' : 's'} ago`;
  }

  const years = Math.round(days / 365);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

export function WordExplorer({
  stats,
  lettersToExpose,
  puzzleDateIso,
  sortBy,
  sortDirection,
  loadingWordStats = false,
}: WordExplorerProps) {

  const sortedStats = useMemo(() => {
    const sorted = [...stats];
    sorted.sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;

      if (sortBy === 'word') {
        return a.word.localeCompare(b.word) * dir;
      }

      // For sorting that requires stats, put words without stats at the end
      const aHasStats = 'frequency' in a;
      const bHasStats = 'frequency' in b;

      if (sortBy === 'lastSeen') {
        // Put words without stats at the end
        if (!aHasStats && !bHasStats) return a.word.localeCompare(b.word);
        if (!aHasStats) return 1;
        if (!bHasStats) return -1;

        const aDates = a.sbHistory;
        const bDates = b.sbHistory;
        const aLast = aDates.length ? aDates[aDates.length - 1] : '';
        const bLast = bDates.length ? bDates[bDates.length - 1] : '';
        if (aLast === bLast) return 0;
        return (aLast > bLast ? 1 : -1) * dir;
      }

      if (sortBy === 'sbCount') {
        // Put words without stats at the end
        if (!aHasStats && !bHasStats) return a.word.localeCompare(b.word);
        if (!aHasStats) return 1;
        if (!bHasStats) return -1;

        const aCount = a.sbHistory.length;
        const bCount = b.sbHistory.length;
        if (aCount === bCount) return 0;
        return (aCount - bCount) * dir;
      }

      // numeric fields: score, frequency, obscurity
      if (sortBy === 'score' || sortBy === 'frequency' || sortBy === 'obscurity') {
      // Score doesn't require stats, but frequency and obscurity do
        if (sortBy === 'score') {
          return (a.score - b.score) * dir;
        }

        // Put words without stats at the end
        if (!aHasStats && !bHasStats) return a.word.localeCompare(b.word);
        if (!aHasStats) return 1;
        if (!bHasStats) return -1;
        if (sortBy === 'obscurity') {
          const aObscurity = 1 - a.commonality;
          const bObscurity = 1 - b.commonality;
          if (aObscurity === bObscurity) return 0;
          return (aObscurity - bObscurity) * dir;
        }

        return (a[sortBy] - b[sortBy]) * dir;
      }

      return 0;
    });
    return sorted;
  }, [stats, sortBy, sortDirection]);

  return (
    <div className="space-y-3">
      {/* Compact sort controls */}
      <div className="space-y-1.5">
        {sortedStats.map(stat => (
          <div
            key={stat.word}
            className="flex flex-col gap-1.5 rounded-md border px-2 py-1.5 sm:grid sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:items-center"
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center">
                <AnswerItem answer={stat.word} lettersToExpose={lettersToExpose} />
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {('frequency' in stat) && !stat.found && (
                  <Badge variant="destructive" className="text-[0.65rem]">
                    Not in frequency corpus
                  </Badge>
                )}
                {('frequency' in stat) === false && loadingWordStats && (
                  <Badge variant="secondary" className="text-[0.65rem] animate-pulse">
                    Loading...
                  </Badge>
                )}
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[0.7rem] font-mono text-muted-foreground sm:text-xs sm:grid-cols-5">
              {SORT_CONFIGS.map(({ key, label, getValue }) => (
                <div key={key}>
                  <dt className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">
                    {label}
                  </dt>
                  <dd className={key === 'score' ? 'font-semibold text-yellow-600' : 'text-foreground'}>
                    {getValue(stat, puzzleDateIso)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
