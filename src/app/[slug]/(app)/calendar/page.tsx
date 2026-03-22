'use client';

import CalendarPageView from '@/components/calendar/CalendarPageView';

export default function CalendarPage() {
  return (
    <div className="h-[calc(100vh-7rem)] lg:h-[calc(100vh-4rem)] flex flex-col min-h-0">
      <CalendarPageView />
    </div>
  );
}
