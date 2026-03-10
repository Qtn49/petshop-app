'use client';

import { useState } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
} from 'date-fns';
import DayTasksPanel from './DayTasksPanel';

export default function DashboardCalendar({ userId }: { userId?: string }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const today = new Date();

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const rows: Date[][] = [];
  let days: Date[] = [];
  let day = startDate;

  while (day <= endDate) {
    days.push(day);
    if (days.length === 7) {
      rows.push(days);
      days = [];
    }
    day = addDays(day, 1);
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handleDayClick = (d: Date) => {
    setSelectedDate(d);
  };

  const getDayClassName = (d: Date) => {
    const base = 'aspect-square w-full flex items-center justify-center rounded-lg text-sm cursor-pointer transition font-medium';
    if (!isSameMonth(d, monthStart)) {
      return `${base} text-slate-300`;
    }
    const isToday = isSameDay(d, today);
    const isSelected = selectedDate && isSameDay(d, selectedDate);
    if (isSelected) {
      return `${base} bg-green-500 text-white hover:bg-green-600`;
    }
    if (isToday) {
      return `${base} bg-primary-100 text-primary-800 font-bold ring-2 ring-primary-400`;
    }
    return `${base} text-slate-700 hover:bg-slate-100`;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
      {selectedDate && (
        <DayTasksPanel date={selectedDate} userId={userId} />
      )}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="font-semibold text-slate-800">Calendar</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
          >
            ‹
          </button>
          <span className="px-4 py-2 font-medium text-slate-800 min-w-[140px] text-center">
            {format(currentDate, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
          >
            ›
          </button>
        </div>
      </div>
      <div className="p-4 overflow-x-auto">
        <table className="w-full min-w-[280px]">
          <thead>
            <tr>
              {weekDays.map((d) => (
                <th key={d} className="text-center text-xs text-slate-500 py-2 font-medium">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((d) => (
                  <td key={d.toISOString()} className="p-1">
                    <button
                      type="button"
                      className={getDayClassName(d)}
                      onClick={() => handleDayClick(d)}
                    >
                      {format(d, 'd')}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
