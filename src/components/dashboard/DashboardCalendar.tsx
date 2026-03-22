'use client';

import { useMemo } from 'react';
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

type Props = {
  /** Month being displayed */
  calendarMonth: Date;
  onMonthChange: (d: Date) => void;
  selectedDate: Date | null;
  onSelectDate: (d: Date | null) => void;
  /** yyyy-MM-dd -> count of day_tasks for that day */
  dayTaskCounts: Map<string, number>;
};

export default function DashboardCalendar({
  calendarMonth,
  onMonthChange,
  selectedDate,
  onSelectDate,
  dayTaskCounts,
}: Props) {
  const today = new Date();

  const monthStart = startOfMonth(calendarMonth);
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

  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const handleDayClick = (d: Date) => {
    if (selectedDate && isSameDay(d, selectedDate)) {
      onSelectDate(null);
    } else {
      onSelectDate(d);
    }
  };

  const getDayClassName = (d: Date) => {
    const base =
      'w-full min-h-[32px] flex items-center justify-center rounded-lg text-xs cursor-pointer transition font-medium relative';
    if (!isSameMonth(d, monthStart)) {
      return `${base} text-stone-300`;
    }
    const isToday = isSameDay(d, today);
    const isSelected = selectedDate && isSameDay(d, selectedDate);
    if (isSelected) {
      return `${base} bg-primary-600 text-white shadow-md shadow-primary-600/25 ring-2 ring-primary-400/50`;
    }
    if (isToday) {
      return `${base} bg-primary-100 text-primary-900 font-bold ring-1 ring-primary-400/60`;
    }
    return `${base} text-stone-700 hover:bg-amber-50/90`;
  };

  const getTaskCount = (d: Date) => {
    const key = format(d, 'yyyy-MM-dd');
    return dayTaskCounts.get(key) ?? 0;
  };

  return (
    <div className="overflow-hidden flex flex-col h-full min-h-0">
      <div className="px-3 py-2 border-b border-amber-50/90 flex items-center justify-between flex-shrink-0">
        <h2 className="font-semibold text-stone-800 text-sm">Calendar</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMonthChange(subMonths(calendarMonth, 1))}
            className="p-1 rounded-lg hover:bg-amber-50 text-stone-600 text-sm"
            aria-label="Previous month"
          >
            ‹
          </button>
          <span className="px-2 py-1 font-semibold text-gray-900 text-xs min-w-[100px] text-center">
            {format(calendarMonth, 'MMM yyyy')}
          </span>
          <button
            type="button"
            onClick={() => onMonthChange(addMonths(calendarMonth, 1))}
            className="p-1 rounded-lg hover:bg-amber-50 text-stone-600 text-sm"
            aria-label="Next month"
          >
            ›
          </button>
        </div>
      </div>
      <div className="px-2 py-2 flex-1 min-h-0 overflow-auto">
        <table className="w-full table-fixed">
          <thead>
            <tr>
              {weekDays.map((d, i) => (
                <th key={i} className="text-center text-[10px] text-stone-400 py-1 font-medium">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((d) => {
                  const count = getTaskCount(d);
                  const isSelected = selectedDate && isSameDay(d, selectedDate);
                  const inMonth = isSameMonth(d, monthStart);
                  return (
                    <td key={d.toISOString()} className="p-0.5 align-top">
                      <button
                        type="button"
                        className={getDayClassName(d)}
                        onClick={() => handleDayClick(d)}
                      >
                        <span className="relative z-[1]">{format(d, 'd')}</span>
                        {count > 0 && inMonth && (
                          <>
                            <span
                              className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${
                                isSelected ? 'bg-white' : 'bg-primary-500'
                              }`}
                            />
                            {count > 1 && (
                              <span
                                className={`absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full text-[9px] font-bold leading-[14px] ${
                                  isSelected
                                    ? 'bg-white text-primary-700'
                                    : 'bg-primary-500 text-white'
                                }`}
                              >
                                {count > 9 ? '9+' : count}
                              </span>
                            )}
                          </>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
