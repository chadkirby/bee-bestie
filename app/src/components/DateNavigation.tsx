import { DateTime } from 'luxon';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import type { OnDateChange } from '@/ui/types';

interface DateNavigationProps {
  currentDate: DateTime;
  latestAvailableDate: DateTime;
  onDateChange: OnDateChange;
}

export function DateNavigation({ currentDate, latestAvailableDate, onDateChange }: DateNavigationProps) {
  const navigateToPrevious = () => {
    onDateChange(currentDate.minus({ days: 1 }));
  };

  const navigateToLatest = () => {
    onDateChange(latestAvailableDate);
  };

  const navigateToNext = () => {
    onDateChange(currentDate.plus({ days: 1 }));
  };

  const isLatest = currentDate.toISODate() === latestAvailableDate.toISODate();
  const canGoNext = (currentDate.toISODate() || '') < (latestAvailableDate.toISODate() || '');

  return (
    <div className="flex items-center justify-center gap-2">
      <Button variant="outline" size="icon" onClick={navigateToPrevious}>
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Button
        variant="outline"
        onClick={navigateToLatest}
        disabled={isLatest}
      >
        <Calendar className="h-4 w-4 mr-2" />
        {isLatest ? 'Latest' : 'Latest'}
      </Button>

      <Button variant="outline" size="icon" onClick={navigateToNext} disabled={!canGoNext}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
