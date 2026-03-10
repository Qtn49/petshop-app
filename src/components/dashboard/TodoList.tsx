'use client';

import { useState } from 'react';
import { Plus, Check, Trash2 } from 'lucide-react';

type Task = {
  id: string;
  title: string;
  completed: boolean;
};

export default function TodoList({
  tasks,
  onTasksChange,
  userId,
}: {
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
  userId?: string;
}) {
  const [newTask, setNewTask] = useState('');

  const addTask = async () => {
    if (!newTask.trim()) return;
    const task: Task = {
      id: crypto.randomUUID(),
      title: newTask.trim(),
      completed: false,
    };
    setNewTask('');
    onTasksChange([...tasks, task]);

    if (userId) {
      try {
        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, title: task.title }),
        });
      } catch {
        // Silent fail
      }
    }
  };

  const toggleTask = async (id: string) => {
    const updated = tasks.map((t) =>
      t.id === id ? { ...t, completed: !t.completed } : t
    );
    onTasksChange(updated);

    if (userId) {
      const task = tasks.find((t) => t.id === id);
      if (task) {
        try {
          await fetch(`/api/tasks/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: !task.completed }),
          });
        } catch {
          // Silent fail
        }
      }
    }
  };

  const deleteTask = async (id: string) => {
    onTasksChange(tasks.filter((t) => t.id !== id));

    if (userId) {
      try {
        await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      } catch {
        // Silent fail
      }
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col h-full min-h-0">
      <div className="p-4 border-b border-slate-100 flex-shrink-0">
        <h2 className="font-semibold text-slate-800">To-Do List</h2>
      </div>
      <div className="p-4 flex flex-col flex-1 min-h-0">
        <ul className="space-y-2 flex-1 overflow-y-auto min-h-0 mb-4">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 group"
            >
              <button
                onClick={() => toggleTask(task.id)}
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  task.completed ? 'bg-primary-600 border-primary-600 text-white' : 'border-slate-300'
                }`}
              >
                {task.completed && <Check className="w-3 h-3" />}
              </button>
              <span
                className={`flex-1 ${task.completed ? 'line-through text-slate-500' : 'text-slate-800'}`}
              >
                {task.title}
              </span>
              <button
                onClick={() => deleteTask(task.id)}
                className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 text-red-500 text-slate-400"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
          {tasks.length === 0 && (
            <p className="text-slate-500 text-sm py-4 text-center">No tasks yet</p>
          )}
        </ul>
        <div className="flex gap-2 flex-shrink-0">
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTask()}
            placeholder="Add a task..."
            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-200 outline-none"
          />
          <button
            onClick={addTask}
            className="p-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
