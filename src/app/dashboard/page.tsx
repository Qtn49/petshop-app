'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardCalendar from '@/components/dashboard/DashboardCalendar';
import TodoList from '@/components/dashboard/TodoList';
import SupplierLinks from '@/components/dashboard/SupplierLinks';
import Notifications from '@/components/dashboard/Notifications';
import { ExternalLink } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const [supplierLinks, setSupplierLinks] = useState<{ id: string; name: string; url: string }[]>([]);
  const [tasks, setTasks] = useState<{ id: string; title: string; completed: boolean }[]>([]);
  const [notifications, setNotifications] = useState<{ id: string; title: string; message: string | null; type: string; read: boolean }[]>([]);

  useEffect(() => {
    if (!user?.id) return;

    const mockLinks = [
      { id: '1', name: 'Aquarium Depot', url: 'https://aquariumdepot.com' },
      { id: '2', name: 'Pet Supplies Plus', url: 'https://petsuppliesplus.com' },
      { id: '3', name: 'Fish World Wholesale', url: 'https://fishworldwholesale.com' },
      { id: '4', name: 'Reptile Kingdom', url: 'https://reptilekingdom.com' },
      { id: '5', name: 'Tropical Fish Co', url: 'https://tropicalfishco.com' },
    ];
    const mockTasks = [
      { id: '1', title: 'Order fish food', completed: false },
      { id: '2', title: 'Check tank levels', completed: true },
      { id: '3', title: 'Restock aquarium filters', completed: false },
      { id: '4', title: 'Schedule vet appointment for store pets', completed: false },
      { id: '5', title: 'Update supplier price list', completed: true },
      { id: '6', title: 'Clean display tanks', completed: false },
      { id: '7', title: 'Order live plants', completed: false },
    ];
    const mockNotifications = [
      { id: '1', title: 'Welcome', message: 'Get started with your dashboard', type: 'info', read: false },
      { id: '2', title: 'Low Stock Alert', message: 'Fish food running low in warehouse', type: 'warning', read: false },
      { id: '3', title: 'Order Shipped', message: 'Supplier order #4521 is on its way', type: 'success', read: true },
      { id: '4', title: 'New Supplier', message: 'Aquarium Depot has new products available', type: 'info', read: false },
      { id: '5', title: 'Reminder', message: 'Tank maintenance due tomorrow', type: 'warning', read: false },
    ];

    const fetchData = async () => {
      try {
        const [linksRes, tasksRes, notifRes] = await Promise.all([
          fetch(`/api/suppliers?userId=${user.id}`),
          fetch(`/api/tasks?userId=${user.id}`),
          fetch(`/api/notifications?userId=${user.id}`),
        ]);

        if (linksRes.ok) {
          const data = await linksRes.json();
          setSupplierLinks(data.links?.length ? data.links : mockLinks);
        } else {
          setSupplierLinks(mockLinks);
        }
        if (tasksRes.ok) {
          const data = await tasksRes.json();
          setTasks(data.tasks?.length ? data.tasks : mockTasks);
        } else {
          setTasks(mockTasks);
        }
        if (notifRes.ok) {
          const data = await notifRes.json();
          setNotifications(data.notifications?.length ? data.notifications : mockNotifications);
        } else {
          setNotifications(mockNotifications);
        }
      } catch {
        setSupplierLinks(mockLinks);
        setTasks(mockTasks);
        setNotifications(mockNotifications);
      }
    };

    fetchData();
  }, [user?.id]);

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col gap-3 overflow-hidden min-h-0">
      <header className="flex-shrink-0">
        <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 text-sm">Your daily shop management tools</p>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-4 lg:grid-rows-2 gap-3 overflow-hidden">
        {/** Calendar - top left, 2 cols */}
        <div className="lg:col-span-2 lg:row-span-1 min-h-0 overflow-auto">
          <DashboardCalendar userId={user?.id} />
        </div>

        {/** Quick Actions - top right */}
        <div className="lg:col-span-1 lg:row-span-1 min-h-0 overflow-auto">
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
        </div>

        {/** Notifications - top right */}
        <div className="lg:col-span-1 lg:row-span-1 min-h-0 overflow-auto">
          <Notifications notifications={notifications} onNotificationsChange={setNotifications} userId={user?.id} />
        </div>

        {/** To-Do List - bottom left */}
        <div className="lg:col-span-2 lg:row-span-1 min-h-0 overflow-auto">
          <TodoList tasks={tasks} onTasksChange={setTasks} userId={user?.id} />
        </div>

        {/** Supplier Links - bottom right */}
        <div className="lg:col-span-2 lg:row-span-1 min-h-0 overflow-auto">
          <SupplierLinks links={supplierLinks} userId={user?.id} />
        </div>
      </div>
    </div>
  );
}
