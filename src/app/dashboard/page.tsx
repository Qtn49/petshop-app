'use client';

import { memo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import DashboardCalendar from '@/components/dashboard/DashboardCalendar';
import TodoList from '@/components/dashboard/TodoList';
import SupplierLinks from '@/components/dashboard/SupplierLinks';
import Notifications from '@/components/dashboard/Notifications';
import WidgetCard from '@/components/dashboard/WidgetCard';
import { WidgetSkeleton } from '@/components/ui/Skeleton';
import { ExternalLink, FileText, ChevronRight } from 'lucide-react';
import { useTasks } from '@/hooks/use-tasks';
import { useNotifications } from '@/hooks/use-notifications';
import { useInvoices } from '@/hooks/use-invoices';
import { useSuppliers } from '@/hooks/use-suppliers';

const RecentInvoices = memo(function RecentInvoices({
  invoices,
  isLoading,
}: {
  invoices: { id: string; file_name: string; status: string }[];
  isLoading: boolean;
}) {
  if (isLoading) return <WidgetSkeleton />;
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-slate-800 text-sm">Recent Invoices</h2>
        <Link
          href="/invoices/list"
          className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1"
        >
          View all
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
      {invoices.length === 0 ? (
        <p className="text-slate-500 text-sm">No invoices yet.</p>
      ) : (
        <ul className="space-y-1 flex-1 min-h-0 overflow-auto">
          {invoices.slice(0, 8).map((inv) => (
            <li key={inv.id}>
              <Link
                href={`/invoices/${inv.id}`}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 transition group"
              >
                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-sm truncate flex-1 min-w-0">{inv.file_name}</span>
                <span className="text-xs text-slate-500 shrink-0">{inv.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

export default function DashboardPage() {
  const { user } = useAuth();
  const userId = user?.id;

  const { tasks, isLoading: tasksLoading, addTask, toggleTask, deleteTask } = useTasks(userId);
  const { notifications, isLoading: notifLoading, markAsRead } = useNotifications(userId);
  const { invoices, isLoading: invoicesLoading } = useInvoices(userId);
  const { links, isLoading: linksLoading } = useSuppliers(userId);

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col gap-3 overflow-hidden min-h-0">
      <header className="flex-shrink-0">
        <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 text-sm">Your daily shop management tools</p>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-4 lg:grid-rows-2 gap-3 overflow-hidden">
        <WidgetCard className="lg:col-span-2 lg:row-span-1 min-h-0 overflow-auto">
          {tasksLoading ? <WidgetSkeleton /> : <DashboardCalendar userId={userId} tasks={tasks} />}
        </WidgetCard>

        <WidgetCard className="lg:col-span-1 lg:row-span-1 min-h-0 overflow-auto">
          <div className="bg-white rounded-xl border border-slate-200 p-3 h-full">
            <h2 className="font-semibold text-slate-800 mb-2 text-sm">Quick Actions</h2>
            <a
              href="https://outlook.office.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:border-primary-300 hover:bg-primary-50 transition"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <ExternalLink className="w-4 h-4 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-slate-800 text-sm">Open Outlook</p>
                <p className="text-xs text-slate-500">Check your email</p>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-400 flex-shrink-0" />
            </a>
          </div>
        </WidgetCard>

        <WidgetCard className="lg:col-span-1 lg:row-span-1 min-h-0 overflow-auto">
          {notifLoading ? (
            <WidgetSkeleton />
          ) : (
            <Notifications
              notifications={notifications}
              onMarkAsRead={(id) => markAsRead.mutate(id)}
              userId={userId}
            />
          )}
        </WidgetCard>

        <WidgetCard className="lg:col-span-2 lg:row-span-1 min-h-0 overflow-auto">
          {tasksLoading ? (
            <WidgetSkeleton />
          ) : (
            <TodoList
              tasks={tasks}
              onAddTask={(title, dueDate) => addTask.mutate({ title, dueDate })}
              onToggleTask={(id) => toggleTask.mutate(id)}
              onDeleteTask={(id) => deleteTask.mutate(id)}
              userId={userId}
            />
          )}
        </WidgetCard>

        <WidgetCard className="lg:col-span-1 lg:row-span-1 min-h-0 overflow-auto">
          {linksLoading ? <WidgetSkeleton /> : <SupplierLinks links={links} userId={userId} />}
        </WidgetCard>

        <WidgetCard className="lg:col-span-1 lg:row-span-1 min-h-0 overflow-auto">
          <RecentInvoices invoices={invoices} isLoading={invoicesLoading} />
        </WidgetCard>
      </div>
    </div>
  );
}
