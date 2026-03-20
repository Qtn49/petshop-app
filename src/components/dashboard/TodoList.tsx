'use client';

import { memo, useState } from 'react';
import { Plus, Check, Trash2, Calendar, Eye, EyeOff } from 'lucide-react';

export type Task = {
  id: string;
  title: string;
  completed: boolean;
  due_date?: string | null;
};

type Props = {
  tasks: Task[];
  userId?: string;
} & (
  | { onAddTask: (title: string, dueDate?: string | null) => void; onToggleTask: (id: string) => void; onDeleteTask: (id: string) => void; onTasksChange?: never }
  | { onTasksChange: (tasks: Task[]) => void; onAddTask?: never; onToggleTask?: never; onDeleteTask?: never }
);

function TodoListInner(props: Props) {
  const { tasks, userId } = props;
  const [newTask, setNewTask] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);

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
          await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, title: task.title, dueDate: task.due_date }),
          });
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
        try { await fetch(`/api/tasks/${id}`, { method: 'DELETE' }); } catch {}
      }
    }
  };

  const visibleTasks = showCompleted ? tasks : tasks.filter((t) => !t.completed);
  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col h-full min-h-0">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
        <h2 className="font-semibold text-slate-800">To-Do List</h2>
        <button
          onClick={() => setShowCompleted((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition"
          title={showCompleted ? 'Hide completed' : 'Show completed'}
        >
          {showCompleted ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {showCompleted ? 'Hide' : 'Show'} completed ({completedCount})
        </button>
      </div>
      <div className="p-4 flex flex-col flex-1 min-h-0">
        <ul className="space-y-2 flex-1 overflow-y-auto min-h-0 mb-4">
          {visibleTasks.map((task) => (
            <li key={task.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 group">
              <button
                onClick={() => toggleTask(task.id)}
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  task.completed ? 'bg-primary-600 border-primary-600 text-white' : 'border-slate-300'
                }`}
              >
                {task.completed && <Check className="w-3 h-3" />}
              </button>
              <div className="flex-1 min-w-0">
                <span className={`block ${task.completed ? 'line-through text-slate-500' : 'text-slate-800'}`}>
                  {task.title}
                </span>
                {task.due_date && (
                  <span className="flex items-center gap-1 text-xs text-primary-500 mt-0.5">
                    <Calendar className="w-3 h-3" />
                    {task.due_date}
                    <span className="text-[10px] text-primary-400">on calendar</span>
                  </span>
                )}
              </div>
              <button
                onClick={() => deleteTask(task.id)}
                className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
          {visibleTasks.length === 0 && (
            <p className="text-slate-500 text-sm py-4 text-center">
              {tasks.length > 0 ? 'All tasks completed!' : 'No tasks yet'}
            </p>
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
          <div className="relative">
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className={`px-3 py-2 rounded-lg border focus:border-primary-500 focus:ring-1 focus:ring-primary-200 outline-none text-sm w-36 ${
                newDueDate ? 'border-primary-300 text-slate-700' : 'border-slate-200 text-slate-400'
              }`}
              title="Due date (optional) — adds task to calendar"
            />
            {newDueDate && (
              <button
                type="button"
                onClick={() => setNewDueDate('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50"
                title="Remove date"
              >
                <span className="text-xs font-bold leading-none">&times;</span>
              </button>
            )}
          </div>
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

export default memo(TodoListInner);
