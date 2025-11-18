import { DateTime } from 'luxon';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import type { OnDateChange } from '@/ui/types';

interface DateNavigationProps {
  currentDate: DateTime;
  onDateChange: OnDateChange;
}

export function DateNavigation({ currentDate, onDateChange }: DateNavigationProps) {
  const navigateToPrevious = () => {
    onDateChange(currentDate.minus({ days: 1 }));
  };

  const navigateToToday = () => {
    onDateChange(DateTime.local().startOf('day'));
  };

  const navigateToNext = () => {
    onDateChange(currentDate.plus({ days: 1 }));
  };

  const isToday = currentDate.toISODate() === DateTime.local().toISODate();

  return (
    <div className="flex items-center justify-center gap-2">
      <Button variant="outline" size="icon" onClick={navigateToPrevious}>
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Button
        variant="outline"
        onClick={navigateToToday}
        disabled={isToday}
      >
        <Calendar className="h-4 w-4 mr-2" />
        {isToday ? 'Today' : 'Today'}
      </Button>

      <Button variant="outline" size="icon" onClick={navigateToNext}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
