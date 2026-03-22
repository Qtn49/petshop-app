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
import { X, Plus, Check, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDayTasksForMonth, useDayTasksForDate, useDayTaskMutations } from '@/hooks/use-day-tasks';
import { dayTasksVisibleOnDate } from '@/lib/day-tasks-calendar';
import { WidgetSkeleton } from '@/components/ui/Skeleton';

export default function CalendarPageView() {
  const { user } = useAuth();
  const userId = user?.id;
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [panelDate, setPanelDate] = useState<Date | null>(null);
  const [newTitle, setNewTitle] = useState('');

  const { data: monthTasks = [], isLoading: monthLoading } = useDayTasksForMonth(userId, calendarMonth);
  const { data: panelTasks = [], isLoading: panelLoading } = useDayTasksForDate(userId, panelDate);
  const { toggleDayTask, deleteDayTask, addDayTask } = useDayTaskMutations(userId);

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

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const tasksForCell = (d: Date) => {
    const key = format(d, 'yyyy-MM-dd');
    return dayTasksVisibleOnDate(monthTasks, key);
  };

  const handleAddInPanel = () => {
    if (!newTitle.trim() || !panelDate || !userId) return;
    addDayTask.mutate(
      { task_date: format(panelDate, 'yyyy-MM-dd'), title: newTitle.trim() },
      { onSuccess: () => setNewTitle('') }
    );
  };

  return (
    <div className="flex flex-col gap-4 min-h-0 flex-1 relative">
      <header className="flex-shrink-0">
        <h1 className="page-title text-2xl">
          Calendar
          <span className="page-title-accent" aria-hidden />
        </h1>
        <p className="text-stone-600 text-sm mt-1">Full month view — tap a day to manage tasks</p>
      </header>

      <div className="rounded-2xl border border-amber-100/90 bg-white shadow-warm-sm overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="px-4 py-3 border-b border-amber-100/80 bg-warm-50/50 flex items-center justify-between">
          <h2 className="font-semibold text-stone-800">{format(calendarMonth, 'MMMM yyyy')}</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
              className="px-3 py-1.5 rounded-xl border border-amber-200/80 text-stone-700 hover:bg-amber-50 text-sm"
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={() => setCalendarMonth(new Date())}
              className="px-3 py-1.5 rounded-xl border border-primary-200 bg-primary-50 text-primary-800 text-sm font-medium"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
              className="px-3 py-1.5 rounded-xl border border-amber-200/80 text-stone-700 hover:bg-amber-50 text-sm"
            >
              Next →
            </button>
          </div>
        </div>

        {monthLoading ? (
          <div className="p-8">
            <WidgetSkeleton />
          </div>
        ) : (
          <div className="p-2 sm:p-4 overflow-auto flex-1 min-h-0">
            <div className="grid grid-cols-7 gap-1 sm:gap-2 min-w-[640px]">
              {weekDays.map((d) => (
                <div
                  key={d}
                  className="text-center text-[10px] sm:text-xs font-semibold text-stone-500 py-2 border-b border-amber-100/60"
                >
                  {d}
                </div>
              ))}
              {rows.flat().map((d) => {
                const inMonth = isSameMonth(d, monthStart);
                const list = tasksForCell(d);
                const count = list.length;
                const isSelected = panelDate && isSameDay(d, panelDate);
                return (
                  <button
                    key={d.toISOString()}
                    type="button"
                    onClick={() => setPanelDate(d)}
                    className={`min-h-[100px] sm:min-h-[120px] rounded-xl border p-2 text-left transition shadow-sm flex flex-col gap-1 ${
                      inMonth
                        ? isSelected
                          ? 'border-primary-400 bg-primary-50/50 ring-2 ring-primary-300/60'
                          : 'border-amber-100/90 bg-white hover:border-amber-200 hover:bg-amber-50/40'
                        : 'border-transparent bg-stone-50/50 text-stone-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span
                        className={`text-sm font-semibold ${
                          isSameDay(d, today) && inMonth
                            ? 'text-primary-700 bg-primary-100 px-1.5 py-0.5 rounded-lg'
                            : inMonth
                              ? 'text-stone-800'
                              : 'text-stone-300'
                        }`}
                      >
                        {format(d, 'd')}
                      </span>
                      {count > 1 && inMonth && (
                        <span className="text-[10px] font-bold bg-primary-500 text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                          {count > 9 ? '9+' : count}
                        </span>
                      )}
                    </div>
                    <ul className="flex-1 space-y-0.5 overflow-hidden min-h-0">
                      {inMonth &&
                        list.slice(0, 4).map((t) => (
                          <li
                            key={t.id}
                            className={`text-[10px] sm:text-xs truncate text-primary-700 font-medium leading-tight ${
                              t.completed ? 'line-through opacity-60' : ''
                            }`}
                          >
                            {t.title}
                          </li>
                        ))}
                      {inMonth && count > 4 && (
                        <li className="text-[10px] text-primary-600 font-medium">+{count - 4} more…</li>
                      )}
                    </ul>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Slide-in panel */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${
          panelDate ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!panelDate}
      >
        <button
          type="button"
          className="absolute inset-0 bg-stone-900/40 backdrop-blur-[1px]"
          onClick={() => setPanelDate(null)}
          aria-label="Close panel"
        />
        <aside
          className={`absolute top-0 right-0 h-full w-full max-w-md bg-white shadow-[-8px_0_32px_-8px_rgba(217,119,6,0.2)] border-l border-amber-100/90 flex flex-col transition-transform duration-300 ease-out ${
            panelDate ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="p-4 border-b border-amber-100/80 bg-warm-50/50 flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Tasks</p>
              <p className="text-lg font-semibold text-stone-800">
                {panelDate ? format(panelDate, 'EEEE, MMM d, yyyy') : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPanelDate(null)}
              className="p-2 rounded-xl hover:bg-amber-100 text-stone-600"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {panelLoading ? (
              <WidgetSkeleton />
            ) : (
              <ul className="space-y-2">
                {panelTasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-amber-100/80 bg-amber-50/20"
                  >
                    <button
                      type="button"
                      onClick={() => toggleDayTask.mutate({ id: task.id, completed: !task.completed })}
                      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        task.completed ? 'bg-primary-600 border-primary-600 text-white' : 'border-stone-300'
                      }`}
                    >
                      {task.completed && <Check className="w-4 h-4" />}
                    </button>
                    <span
                      className={`flex-1 text-sm ${task.completed ? 'line-through text-stone-500' : 'text-stone-800'}`}
                    >
                      {task.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteDayTask.mutate(task.id)}
                      className="p-2 rounded-lg hover:bg-red-50 text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
                {panelTasks.length === 0 && !panelLoading && (
                  <p className="text-stone-500 text-sm text-center py-6">No tasks for this day.</p>
                )}
              </ul>
            )}
          </div>

          <div className="p-4 border-t border-amber-100/80 bg-white space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddInPanel()}
                placeholder="New task for this day…"
                className="flex-1 px-3 py-2.5 rounded-xl border border-amber-200/90 focus:border-primary-500 focus:ring-2 focus:ring-primary-400/30 outline-none"
              />
              <button
                type="button"
                onClick={handleAddInPanel}
                disabled={!newTitle.trim() || addDayTask.isPending}
                className="px-4 py-2.5 rounded-xl bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 flex items-center gap-1"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[10px] text-stone-500">Adds a calendar task (day_tasks) for this date.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
