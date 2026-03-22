'use client';

import { memo, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Plus, Check, Trash2, Calendar, CalendarDays, Eye, EyeOff } from 'lucide-react';
import { useDayTasksForDate, useDayTaskMutations } from '@/hooks/use-day-tasks';
import { WidgetSkeleton } from '@/components/ui/Skeleton';

export type Task = {
  id: string;
  title: string;
  completed: boolean;
  due_date?: string | null;
};

type Props = {
  tasks: Task[];
  userId?: string;
  /** When set (e.g. from dashboard calendar), shows “Tasks for [date]” + day_tasks. */
  selectedDate?: Date | null;
} & (
  | { onAddTask: (title: string, dueDate?: string | null) => void; onToggleTask: (id: string) => void; onDeleteTask: (id: string) => void; onTasksChange?: never }
  | { onTasksChange: (tasks: Task[]) => void; onAddTask?: never; onToggleTask?: never; onDeleteTask?: never }
);

function TodoListInner(props: Props) {
  const { tasks, userId, selectedDate = null } = props;
  const [newTask, setNewTask] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    if (selectedDate) {
      setNewDueDate(format(selectedDate, 'yyyy-MM-dd'));
      setShowDatePicker(true);
    }
  }, [selectedDate]);

  const { data: dayTasks = [], isLoading: dayLoading } = useDayTasksForDate(userId, selectedDate);
  const { toggleDayTask, deleteDayTask, addDayTask } = useDayTaskMutations(userId);

  const addTask = async () => {
    if (!newTask.trim()) return;
    if (props.onAddTask) {
      props.onAddTask(newTask.trim(), newDueDate || null);
    } else if (props.onTasksChange) {
      const task: Task = {
        id: crypto.randomUUID(),
        title: newTask.trim(),
        completed: false,
        due_date: newDueDate || null,
      };
      props.onTasksChange([...tasks, task]);
      if (userId) {
        try {
          if (newDueDate) {
            await fetch('/api/day-tasks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId,
                task_date: newDueDate,
                title: task.title,
                frequency: 'once',
              }),
            });
          } else {
            await fetch('/api/tasks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, title: task.title }),
            });
          }
        } catch {}
      }
    }
    setNewTask('');
    setNewDueDate('');
  };

  const toggleTask = async (id: string) => {
    if (props.onToggleTask) {
      props.onToggleTask(id);
    } else if (props.onTasksChange) {
      const updated = tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t));
      props.onTasksChange(updated);
      if (userId) {
        const task = tasks.find((t) => t.id === id);
        if (task) {
          try {
            await fetch(`/api/tasks/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ completed: !task.completed }),
            });
          } catch {}
        }
      }
    }
  };

  const deleteTask = async (id: string) => {
    if (props.onDeleteTask) {
      props.onDeleteTask(id);
    } else if (props.onTasksChange) {
      props.onTasksChange(tasks.filter((t) => t.id !== id));
      if (userId) {
        try {
          await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
        } catch {}
      }
    }
  };

  const visibleTasks = showCompleted ? tasks : tasks.filter((t) => !t.completed);
  const completedCount = tasks.filter((t) => t.completed).length;

  const dateLabel = selectedDate ? format(selectedDate, 'EEEE, MMM d, yyyy') : '';
  const visibleDayTasks = showCompleted ? dayTasks : dayTasks.filter((t) => !t.completed);

  return (
    <div className="overflow-hidden flex flex-col h-full min-h-0">
      <div className="p-4 border-b border-amber-50/90 flex items-center justify-between flex-shrink-0">
        <h2 className="font-semibold text-stone-800">To-Do List</h2>
        <button
          type="button"
          onClick={() => setShowCompleted((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-700 transition"
          title={showCompleted ? 'Hide completed' : 'Show completed'}
        >
          {showCompleted ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {showCompleted ? 'Hide' : 'Show'} completed ({completedCount})
        </button>
      </div>
      <div className="p-4 flex flex-col flex-1 min-h-0 overflow-y-auto">
        {selectedDate && (
          <>
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-stone-800 flex items-center gap-2">
                <span aria-hidden>📅</span> Tasks for {dateLabel}
              </h3>
              {dayLoading ? (
                <div className="mt-2">
                  <WidgetSkeleton />
                </div>
              ) : (
                <ul className="space-y-2 mt-2">
                  {visibleDayTasks.map((task) => (
                    <li key={task.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-amber-50/60 group border border-amber-100/60">
                      <button
                        type="button"
                        onClick={() => toggleDayTask.mutate({ id: task.id, completed: !task.completed })}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          task.completed ? 'bg-primary-600 border-primary-600 text-white' : 'border-stone-300'
                        }`}
                      >
                        {task.completed && <Check className="w-3 h-3" />}
                      </button>
                      <span
                        className={`flex-1 min-w-0 text-sm ${task.completed ? 'line-through text-stone-500' : 'text-stone-800'}`}
                      >
                        {task.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteDayTask.mutate(task.id)}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                  {visibleDayTasks.length === 0 && (
                    <p className="text-stone-500 text-sm py-2">No tasks for this day.</p>
                  )}
                </ul>
              )}
            </div>

            <div className="relative my-4 flex items-center gap-3">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary-300/80 to-transparent" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-primary-700 whitespace-nowrap">
                📝 To-Do List
              </span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary-300/80 to-transparent" />
            </div>
          </>
        )}

        <ul className="space-y-2 flex-1 min-h-0 mb-4">
          {visibleTasks.map((task) => (
            <li key={task.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-amber-50/80 group">
              <button
                type="button"
                onClick={() => toggleTask(task.id)}
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  task.completed ? 'bg-primary-600 border-primary-600 text-white' : 'border-stone-300'
                }`}
              >
                {task.completed && <Check className="w-3 h-3" />}
              </button>
              <div className="flex-1 min-w-0">
                <span className={`block ${task.completed ? 'line-through text-stone-500' : 'text-stone-800'}`}>
                  {task.title}
                </span>
              </div>
              <button
                type="button"
                onClick={() => deleteTask(task.id)}
                className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
          {visibleTasks.length === 0 && (
            <p className="text-stone-500 text-sm py-4 text-center">
              {tasks.length > 0 ? 'All general tasks completed!' : 'No general tasks yet'}
            </p>
          )}
        </ul>

        <div className="flex flex-col gap-2 flex-shrink-0 pt-2 border-t border-amber-50/80">
          <div className="flex gap-2">
            <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTask()}
              placeholder={selectedDate ? 'Add a general task…' : 'Add a task…'}
              className="flex-1 px-3 py-2 rounded-xl border border-amber-200/90 focus:border-primary-500 focus:ring-2 focus:ring-primary-400/30 outline-none bg-white text-stone-900 placeholder:text-stone-400"
            />
            <button
              type="button"
              onClick={() => {
                setShowDatePicker((v) => {
                  if (v) setNewDueDate('');
                  return !v;
                });
              }}
              className={`p-2 rounded-xl border transition-colors shrink-0 ${
                showDatePicker
                  ? 'bg-amber-100 border-amber-400 text-amber-700'
                  : 'bg-white border-amber-200/90 text-stone-400 hover:text-amber-600 hover:border-amber-300'
              }`}
              title={showDatePicker ? 'Hide date (save to general list)' : 'Add a date (saves to calendar)'}
            >
              <Calendar className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={addTask}
              className="p-2 rounded-xl bg-primary-600 text-white hover:bg-primary-700 shadow-md shadow-primary-600/20 shrink-0"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          {showDatePicker && (
            <div className="relative flex items-center">
              <CalendarDays className="absolute left-2.5 w-4 h-4 text-amber-500 pointer-events-none" />
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className={`w-full pl-9 pr-8 py-2 rounded-xl border text-sm bg-amber-50 shadow-inner transition-colors
                  [color-scheme:light] focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-500
                  ${newDueDate ? 'border-amber-400 text-stone-800' : 'border-amber-300 text-stone-500'}`}
                title="Due date — saves task to the calendar"
              />
              {newDueDate && (
                <button
                  type="button"
                  onClick={() => setNewDueDate('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-stone-400 hover:text-red-500 hover:bg-red-50"
                  title="Clear date"
                >
                  <span className="text-xs font-bold leading-none">&times;</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(TodoListInner);
