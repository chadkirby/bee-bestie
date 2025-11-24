import { useMemo } from 'react';
import { DateTime } from 'luxon';
import { Link } from 'react-router-dom';

interface Occurrence {
  date: string;
  centerLetter: string;
  outerLetters: string[];
}

interface WordTimelineProps {
  occurrences: Occurrence[];
  word: string;
}

export function WordTimeline({ occurrences, word }: WordTimelineProps) {
  // 1. Determine range of years
  const startYear = 2022;
  const currentYear = DateTime.now().year;
  const years = useMemo(() => {
    const y = [];
    for (let i = startYear; i <= currentYear; i++) {
      y.push(i);
    }
    return y;
  }, [currentYear]);

  // 2. Group occurrences by year
  const occurrencesByYear = useMemo(() => {
    const map = new Map<number, Occurrence[]>();
    occurrences.forEach((occ) => {
      const dt = DateTime.fromISO(occ.date);
      const year = dt.year;
      if (!map.has(year)) map.set(year, []);
      map.get(year)!.push(occ);
    });
    return map;
  }, [occurrences]);

  // Helper to get left position % for a date
  const getLeftPercent = (dateStr: string) => {
    const dt = DateTime.fromISO(dateStr);
    const startOfYear = DateTime.fromObject({ year: dt.year, month: 1, day: 1 });
    const endOfYear = DateTime.fromObject({ year: dt.year, month: 12, day: 31 });
    const totalDays = endOfYear.diff(startOfYear, 'days').days;
    const dayOfYear = dt.diff(startOfYear, 'days').days;
    return (dayOfYear / totalDays) * 100;
  };

  const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

  return (
    <div className="w-full space-y-6">
      <div className="relative">
        {/* Global Month Labels (Top) */}
        <div className="flex justify-between px-12 mb-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
          {months.map((m, i) => (
            <div key={i} className="flex-1 text-center">
              {m}
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {years.map((year) => {
            const yearOccurrences = occurrencesByYear.get(year) || [];

            return (
              <div key={year} className="relative flex items-center group">
                {/* Year Label */}
                <div className="w-12 text-sm font-bold text-gray-500 shrink-0">
                  {year}
                </div>

                {/* Timeline Track */}
                <div className="relative flex-grow h-8 bg-gray-50 rounded-full border border-gray-100 overflow-hidden">
                  {/* Month Grid Lines (Optional, subtle) */}
                  <div className="absolute inset-0 flex">
                    {months.map((_, i) => (
                      <div key={i} className="flex-1 border-r border-gray-100 last:border-0" />
                    ))}
                  </div>

                  {/* Markers */}
                  {yearOccurrences.map((occ) => (
                    <Link
                      key={occ.date}
                      to={`/puzzle/${occ.date}/words`}
                      state={{ fromWord: word }}
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 rounded-full hover:bg-blue-600 hover:scale-125 transition-all shadow-sm z-10"
                      style={{ left: `${getLeftPercent(occ.date)}%` }}
                      title={`${DateTime.fromISO(occ.date).toFormat('LLL d, yyyy')} • ${occ.centerLetter}/${occ.outerLetters.join('')}`}
                    >
                      <span className="sr-only">
                        {DateTime.fromISO(occ.date).toFormat('LLL d, yyyy')}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
