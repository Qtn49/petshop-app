'use client';

import { useMemo, useState } from 'react';
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

type TaskWithDate = {
  id: string;
  title: string;
  completed: boolean;
  due_date?: string | null;
};

export default function DashboardCalendar({
  userId,
  tasks = [],
}: {
  userId?: string;
  tasks?: TaskWithDate[];
}) {
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

  const tasksByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tasks) {
      if (t.due_date) {
        const key = typeof t.due_date === 'string' ? t.due_date.slice(0, 10) : '';
        if (key) map.set(key, (map.get(key) ?? 0) + 1);
      }
    }
    return map;
  }, [tasks]);

  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const handleDayClick = (d: Date) => {
    if (selectedDate && isSameDay(d, selectedDate)) {
      setSelectedDate(null);
    } else {
      setSelectedDate(d);
    }
  };

  const getDayClassName = (d: Date) => {
    const height = selectedDate ? 'h-7' : 'h-full min-h-[28px]';
    const base = `w-full ${height} flex items-center justify-center rounded text-xs cursor-pointer transition font-medium relative`;
    if (!isSameMonth(d, monthStart)) {
      return `${base} text-slate-300`;
    }
    const isToday = isSameDay(d, today);
    const isSelected = selectedDate && isSameDay(d, selectedDate);
    if (isSelected) {
      return `${base} bg-green-500 text-white hover:bg-green-600`;
    }
    if (isToday) {
      return `${base} bg-primary-100 text-primary-800 font-bold ring-1 ring-primary-400`;
    }
    return `${base} text-slate-700 hover:bg-slate-100`;
  };

  const getTaskCount = (d: Date) => {
    const key = format(d, 'yyyy-MM-dd');
    return tasksByDate.get(key) ?? 0;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col h-full">
      <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
        <h2 className="font-semibold text-slate-800 text-sm">Calendar</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="p-1 rounded hover:bg-slate-100 text-slate-600 text-sm"
          >
            ‹
          </button>
          <span className="px-2 py-1 font-medium text-slate-800 text-xs min-w-[100px] text-center">
            {format(currentDate, 'MMM yyyy')}
          </span>
          <button
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="p-1 rounded hover:bg-slate-100 text-slate-600 text-sm"
          >
            ›
          </button>
        </div>
      </div>
      <div className={`px-2 py-1 ${selectedDate ? 'flex-shrink-0' : 'flex-1 min-h-0'}`}>
        <table className="w-full table-fixed" style={selectedDate ? undefined : { height: '100%' }}>
          <thead>
            <tr>
              {weekDays.map((d, i) => (
                <th key={i} className="text-center text-[10px] text-slate-400 py-1 font-medium">
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
                  return (
                    <td key={d.toISOString()} className="p-0.5">
                      <button
                        type="button"
                        className={getDayClassName(d)}
                        onClick={() => handleDayClick(d)}
                      >
                        {format(d, 'd')}
                        {count > 0 && isSameMonth(d, monthStart) && (
                          <span
                            className={`absolute -bottom-0.5 w-1 h-1 rounded-full ${
                              isSelected ? 'bg-white' : 'bg-primary-500'
                            }`}
                          />
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
      {selectedDate && (
        <DayTasksPanel date={selectedDate} userId={userId} />
      )}
    </div>
  );
}
