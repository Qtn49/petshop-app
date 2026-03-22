'use client';

import { memo, useEffect, useMemo, useState, type ComponentType } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { format, isToday, parseISO } from 'date-fns';
import DashboardCalendar from '@/components/dashboard/DashboardCalendar';
import TodoList from '@/components/dashboard/TodoList';
import SupplierLinks from '@/components/dashboard/SupplierLinks';
import Notifications from '@/components/dashboard/Notifications';
import WidgetCard from '@/components/dashboard/WidgetCard';
import { WidgetSkeleton } from '@/components/ui/Skeleton';
import {
  ExternalLink,
  FileText,
  ChevronRight,
  MessageCircle,
  Mail,
  MessageSquare,
  ClipboardCheck,
  ListTodo,
  Fish,
} from 'lucide-react';
import { useTasks } from '@/hooks/use-tasks';
import { useNotifications } from '@/hooks/use-notifications';
import { useInvoices } from '@/hooks/use-invoices';
import { useSuppliers } from '@/hooks/use-suppliers';

async function fetchTanks(userId: string): Promise<{ id: string }[]> {
  const res = await fetch(`/api/tanks?userId=${userId}`);
  if (!res.ok) return [];
  const d = await res.json();
  return d.tanks ?? [];
}

const RecentInvoices = memo(function RecentInvoices({
  invoices,
  isLoading,
}: {
  invoices: { id: string; file_name: string; status: string }[];
  isLoading: boolean;
}) {
  if (isLoading) return <WidgetSkeleton />;
  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-stone-800 text-sm">Recent Invoices</h2>
        <Link
          href="/invoices/list"
          className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1"
        >
          View all
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
      {invoices.length === 0 ? (
        <p className="text-stone-500 text-sm">No invoices yet.</p>
      ) : (
        <ul className="space-y-1 flex-1 min-h-0 overflow-auto">
          {invoices.slice(0, 8).map((inv) => (
            <li key={inv.id}>
              <Link
                href={`/invoices/${inv.id}`}
                className="flex items-center gap-2 p-2 rounded-xl hover:bg-amber-50/80 transition group border border-transparent hover:border-amber-100 hover:shadow-sm"
              >
                <FileText className="w-4 h-4 text-amber-600/70 shrink-0" />
                <span className="text-sm truncate flex-1 min-w-0 text-stone-700">{inv.file_name}</span>
                <span className="text-xs text-stone-500 shrink-0">{inv.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

function KpiCard({
  href,
  label,
  value,
  icon: Icon,
  sub,
}: {
  href: string;
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
  sub?: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-2xl bg-white border border-amber-100/80 p-4 shadow-warm-sm transition hover:scale-[1.01] hover:shadow-warm hover:border-amber-200/90"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-stone-800 tabular-nums">{value}</p>
          {sub ? <p className="mt-0.5 text-xs text-stone-500">{sub}</p> : null}
        </div>
        <div className="rounded-xl bg-amber-50 p-2.5 text-primary-600 group-hover:bg-amber-100 transition">
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const userId = user?.id;

  const [clock, setClock] = useState<string>('');
  const [greeting, setGreeting] = useState('Hello');

  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setClock(format(n, 'EEEE, MMMM d, yyyy • h:mm a'));
      const h = n.getHours();
      if (h < 12) setGreeting('Good morning');
      else if (h < 17) setGreeting('Good afternoon');
      else setGreeting('Good evening');
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const { tasks, isLoading: tasksLoading, addTask, toggleTask, deleteTask } = useTasks(userId);
  const { notifications, isLoading: notifLoading, markAsRead } = useNotifications(userId);
  const { invoices, isLoading: invoicesLoading } = useInvoices(userId);
  const { links, isLoading: linksLoading } = useSuppliers(userId);

  const { data: tanks = [] } = useQuery({
    queryKey: ['tanks', userId],
    queryFn: () => fetchTanks(userId!),
    enabled: !!userId,
  });

  const parsedInvoicesCount = useMemo(
    () => invoices.filter((i) => i.status === 'parsed').length,
    [invoices]
  );

  const tasksDueToday = useMemo(
    () =>
      tasks.filter(
        (t) => !t.completed && t.due_date && isToday(parseISO(t.due_date))
      ).length,
    [tasks]
  );

  return (
    <div className="min-h-screen flex flex-col gap-4 overflow-hidden pb-2 lg:pb-0">
      {/* Hero */}
      <div className="flex-shrink-0 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-400 to-amber-600 p-5 md:p-6 text-white shadow-warm">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="text-lg md:text-xl font-semibold">
              {greeting} 👋
            </p>
            <p className="mt-1 text-sm text-white/90">{clock}</p>
          </div>
          <div className="text-xs text-white/80 max-w-[16rem]">
            Here’s your shop at a glance — stay on top of invoices, tasks, and tanks.
          </div>
        </div>
      </div>

      {/* Page title */}
      <header className="flex-shrink-0">
        <h1 className="page-title">
          Dashboard
          <span className="page-title-accent" aria-hidden />
        </h1>
        <p className="text-stone-600 text-sm mt-1">Your daily shop management tools</p>
      </header>

      {/* KPI row */}
      {userId && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-shrink-0">
          <KpiCard
            href="/invoices/list"
            label="Invoices parsed"
            value={parsedInvoicesCount}
            icon={ClipboardCheck}
            sub="Ready for review"
          />
          <KpiCard
            href="/tasks"
            label="Tasks due today"
            value={tasksDueToday}
            icon={ListTodo}
            sub="Open items"
          />
          <KpiCard
            href="/aquariums"
            label="Aquariums"
            value={tanks.length}
            icon={Fish}
            sub="Active tanks"
          />
        </div>
      )}

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-4 lg:grid-rows-2 gap-3 overflow-hidden">
        <WidgetCard className="lg:col-span-2 lg:row-span-1 min-h-0 overflow-auto">
          {tasksLoading ? <WidgetSkeleton /> : <DashboardCalendar userId={userId} tasks={tasks} />}
        </WidgetCard>

        <WidgetCard className="lg:col-span-1 lg:row-span-1 min-h-0 overflow-auto">
          <div className="p-3 h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-stone-800 text-sm">Quick actions</h2>
              <Link
                href="/communications"
                className="text-primary-600 hover:text-primary-700 text-xs font-medium flex items-center gap-0.5"
              >
                All
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1 min-h-0">
              <a
                href="imessage://"
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border border-amber-100/90 bg-amber-50/40 hover:bg-amber-50 hover:scale-[1.02] hover:shadow-warm-sm transition text-center"
              >
                <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-xs font-medium text-stone-800">Messages</span>
                <span className="text-[10px] text-stone-500">iMessage</span>
                <ExternalLink className="w-3 h-3 text-stone-400" />
              </a>
              <a
                href="https://messenger.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border border-amber-100/90 bg-amber-50/40 hover:bg-amber-50 hover:scale-[1.02] hover:shadow-warm-sm transition text-center"
              >
                <div className="w-11 h-11 rounded-xl bg-sky-100 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-sky-600" />
                </div>
                <span className="text-xs font-medium text-stone-800">Messenger</span>
                <span className="text-[10px] text-stone-500">Facebook</span>
                <ExternalLink className="w-3 h-3 text-stone-400" />
              </a>
              <a
                href="https://outlook.office.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border border-amber-100/90 bg-amber-50/40 hover:bg-amber-50 hover:scale-[1.02] hover:shadow-warm-sm transition text-center"
              >
                <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-amber-800" />
                </div>
                <span className="text-xs font-medium text-stone-800">Outlook</span>
                <span className="text-[10px] text-stone-500">Email</span>
                <ExternalLink className="w-3 h-3 text-stone-400" />
              </a>
            </div>
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
