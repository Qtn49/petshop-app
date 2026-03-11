'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Plus, Check, Trash2 } from 'lucide-react';

type DayTask = {
  id: string;
  title: string;
  completed: boolean;
  notes: string | null;
  frequency?: string;
};

const FREQUENCY_OPTIONS = [
  { value: 'once', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
] as const;

const DEFAULT_TASKS: DayTask[] = [
  { id: '1', title: 'Morning tank check', completed: true, notes: null, frequency: 'daily' },
  { id: '2', title: 'Feed display fish', completed: false, notes: null, frequency: 'daily' },
  { id: '3', title: 'Test water parameters', completed: false, notes: null, frequency: 'weekly' },
  { id: '4', title: 'Restock fish food shelf', completed: false, notes: null, frequency: 'once' },
  { id: '5', title: 'Clean quarantine tank', completed: false, notes: null, frequency: 'monthly' },
];

export default function DayTasksPanel({
  date,
  userId,
}: {
  date: Date;
  userId?: string;
}) {
  const [tasks, setTasks] = useState<DayTask[]>([]);
  const [newTask, setNewTask] = useState('');
  const [newTaskFrequency, setNewTaskFrequency] = useState<string>('once');
  const [loading, setLoading] = useState(true);

  const dateStr = format(date, 'yyyy-MM-dd');

  useEffect(() => {
    if (!userId) {
      setTasks(DEFAULT_TASKS);
      setLoading(false);
      return;
    }
    fetch(`/api/day-tasks?userId=${userId}&date=${dateStr}`)
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks?.length ? d.tasks : DEFAULT_TASKS))
      .catch(() => setTasks(DEFAULT_TASKS))
      .finally(() => setLoading(false));
  }, [userId, dateStr]);

  const addTask = async () => {
    if (!newTask.trim() || !userId) return;
    const task: DayTask = {
      id: crypto.randomUUID(),
      title: newTask.trim(),
      completed: false,
      notes: null,
      frequency: newTaskFrequency,
    };
    try {
      const res = await fetch('/api/day-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          task_date: dateStr,
          title: newTask.trim(),
          frequency: newTaskFrequency,
        }),
      });
      const data = await res.json();
      if (res.ok) setTasks([...tasks, { ...data, frequency: data.frequency || newTaskFrequency }]);
      else setTasks([...tasks, task]);
      setNewTask('');
    } catch {
      setTasks([...tasks, task]);
      setNewTask('');
    }
  };

  const toggleTask = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const updated = tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t));
    setTasks(updated);
    try {
      await fetch(`/api/day-tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !task.completed }),
      });
    } catch {}
  };

  const deleteTask = async (id: string) => {
    setTasks(tasks.filter((t) => t.id !== id));
    try {
      await fetch(`/api/day-tasks/${id}`, { method: 'DELETE' });
    } catch {}
  };

  return (
    <div className="border-b border-slate-100 p-4 bg-slate-50/50">
      <h3 className="font-semibold text-slate-800 mb-3 text-sm">
        Tasks for {format(date, 'EEEE, MMMM d')}
      </h3>
      {loading ? (
        <p className="text-slate-500 text-sm">Loading...</p>
      ) : (
        <>
          <ul className="space-y-2 mb-3 max-h-32 overflow-y-auto">
            {tasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center gap-3 p-2 rounded-lg bg-white border border-slate-100 hover:bg-slate-50 group"
              >
                <button
                  onClick={() => toggleTask(task.id)}
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    task.completed ? 'bg-primary-600 border-primary-600 text-white' : 'border-slate-300'
                  }`}
                >
                  {task.completed && <Check className="w-2.5 h-2.5" />}
                </button>
                <span
                  className={`flex-1 text-sm ${task.completed ? 'line-through text-slate-500' : 'text-slate-800'}`}
                >
                  {task.title}
                  {task.frequency && task.frequency !== 'once' && (
                    <span className="ml-2 text-xs text-slate-400 capitalize">({task.frequency})</span>
                  )}
                </span>
                <button
                  onClick={() => deleteTask(task.id)}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 text-red-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
            {tasks.length === 0 && !loading && (
              <p className="text-slate-500 text-sm py-2">No tasks for this day</p>
            )}
          </ul>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTask()}
              placeholder="Add task..."
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-200 outline-none"
            />
            <select
              value={newTaskFrequency}
              onChange={(e) => setNewTaskFrequency(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-200 outline-none bg-white"
              title="Frequency"
            >
              {FREQUENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              onClick={addTask}
              className="p-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
