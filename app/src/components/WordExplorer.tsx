import { useMemo, useState } from 'react';
import { DateTime } from 'luxon';
import { AnswerItem } from '@/components/AnswerItem';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export type ExposureConfig = {
  startingLetters: number;
  endingLetters: number;
};

export type WordStatsRecord = {
  word: string;
  found: boolean;
  frequency: number;
  commonality: number;
  // `probability` exists on the backend schema but we intentionally
  // ignore it in the UI for now.
  probability: number;
  /** All historical puzzle dates where this word appeared, before the current puzzle. */
  sbHistory: string[];
};

// Sorting by frequency (hard count), commonality, SB history, or word (alpha).
export type SortKey = 'frequency' | 'commonality' | 'sbCount' | 'lastSeen' | 'word';

interface WordExplorerProps {
  stats: WordStatsRecord[];
  lettersToExpose: ExposureConfig;
  /** ISO date string for the current puzzle (YYYY-MM-DD). */
  puzzleDateIso: string;
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

export function WordExplorer({ stats, lettersToExpose, puzzleDateIso }: WordExplorerProps) {
  const [sortBy, setSortBy] = useState<SortKey>('frequency');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const sortedStats = useMemo(() => {
    const sorted = [...stats];
    sorted.sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;

      if (sortBy === 'word') {
        return a.word.localeCompare(b.word) * dir;
      }

      if (sortBy === 'lastSeen') {
        const aDates = a.sbHistory;
        const bDates = b.sbHistory;
        const aLast = aDates.length ? aDates[aDates.length - 1] : '';
        const bLast = bDates.length ? bDates[bDates.length - 1] : '';
        if (aLast === bLast) return 0;
        return (aLast > bLast ? 1 : -1) * dir;
      }

      if (sortBy === 'sbCount') {
        const aCount = a.sbHistory.length;
        const bCount = b.sbHistory.length;
        if (aCount === bCount) return 0;
        return (aCount - bCount) * dir;
      }

      // numeric fields: frequency, commonality
      if (sortBy === 'frequency' || sortBy === 'commonality') {
        return (a[sortBy] - b[sortBy]) * dir;
      }

      return 0;
    });
    return sorted;
  }, [stats, sortBy, sortDirection]);

  return (
    <div className="space-y-3">
      {/* Compact sort controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Sort</span>
          <select
            id="sort-by"
            className="h-7 rounded-md border bg-background px-2 text-xs"
            value={sortBy}
            onChange={event => setSortBy(event.target.value as SortKey)}
          >
            <option value="frequency">Frequency</option>
            <option value="commonality">Commonality</option>
            <option value="sbCount">SB count</option>
            <option value="lastSeen">Last seen</option>
            <option value="word">Word</option>
          </select>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          onClick={() => setSortDirection(dir => (dir === 'desc' ? 'asc' : 'desc'))}
        >
          {sortDirection === 'desc' ? '↓ Desc' : '↑ Asc'}
        </Button>
      </div>

      <div className="space-y-1.5">
        {sortedStats.map(stat => (
          <div
            key={stat.word}
            className="flex flex-col gap-1.5 rounded-md border px-2 py-1.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-2">
              <AnswerItem answer={stat.word} lettersToExpose={lettersToExpose} />
              {!stat.found && (
                <Badge variant="destructive" className="text-[0.65rem]">
                  Not in frequency corpus
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-3 text-[0.7rem] font-mono text-muted-foreground sm:text-xs">
              <div>
                <div className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">
                  Frequency
                </div>
                <div className="text-foreground">
                  {stat.frequency.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">
                  Commonality
                </div>
                <div className="text-foreground">
                  {stat.commonality.toFixed(3)}
                </div>
              </div>
              <div>
                <div className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">
                  SB Count
                </div>
                <div className="text-foreground">
                  {stat.sbHistory.length}
                </div>
              </div>
              <div>
                <div className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">
                  Last seen
                </div>
                <div className="text-foreground">
                  {formatLastSeen(puzzleDateIso, stat.sbHistory)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
