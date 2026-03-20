'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { Plus, Fish, ChevronRight } from 'lucide-react';

type Tank = {
  id: string;
  name: string;
  fish_species: string | null;
  fish_count: number;
  notes: string | null;
};

async function fetchTanks(userId: string): Promise<Tank[]> {
  const res = await fetch(`/api/tanks?userId=${userId}`);
  if (!res.ok) return [];
  const d = await res.json();
  return d.tanks ?? [];
}

export default function AquariumsPage() {
  const { user } = useAuth();

  const { data: tanks = [], isLoading } = useQuery({
    queryKey: ['tanks', user?.id],
    queryFn: () => fetchTanks(user!.id),
    enabled: !!user?.id,
  });

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Aquarium Management</h1>
          <p className="text-slate-500 mt-1">Manage your tanks and fish</p>
        </div>
        <a href="/aquariums/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Tank
          </Button>
        </a>
      </header>

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : tanks.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Fish className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 mb-4">No aquariums yet</p>
            <a href="/aquariums/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add your first tank
              </Button>
            </a>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tanks.map((tank) => (
            <a key={tank.id} href={`/aquariums/${tank.id}`} className="block">
              <Card className="hover:border-primary-200 transition cursor-pointer">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800">{tank.name}</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      {tank.fish_species || 'No species'}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">{tank.fish_count} fish</p>
                    {tank.notes && (
                      <p className="text-sm text-slate-500 mt-2 truncate max-w-[200px]">{tank.notes}</p>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
              </Card>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
