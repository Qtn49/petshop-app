'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Plus, Fish, ChevronRight } from 'lucide-react';

type Tank = {
  id: string;
  name: string;
  fish_species: string | null;
  fish_count: number;
  notes: string | null;
};

export default function AquariumsPage() {
  const { user } = useAuth();
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [loading, setLoading] = useState(true);

  const mockTanks: Tank[] = [
    { id: '1', name: 'Display Tank 1', fish_species: 'Neon Tetra', fish_count: 12, notes: 'Main store display' },
    { id: '2', name: 'Display Tank 2', fish_species: 'Guppy', fish_count: 8, notes: 'Breeding pair' },
    { id: '3', name: 'Reptile Section', fish_species: null, fish_count: 0, notes: 'Holds reptiles, not fish' },
    { id: '4', name: 'Quarantine Tank', fish_species: 'Mixed', fish_count: 5, notes: 'New arrivals' },
    { id: '5', name: 'Cichlid Tank', fish_species: 'African Cichlid', fish_count: 6, notes: 'pH 8.0' },
  ];

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/tanks?userId=${user.id}`)
      .then((r) => r.json())
      .then((d) => {
        setTanks(d.tanks?.length ? d.tanks : mockTanks);
      })
      .catch(() => setTanks(mockTanks))
      .finally(() => setLoading(false));
  }, [user?.id]);

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

      {loading ? (
        <p className="text-slate-500">Loading...</p>
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
            <a
              key={tank.id}
              href={`/aquariums/${tank.id}`}
              className="block"
            >
              <Card className="hover:border-primary-200 transition cursor-pointer">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800">{tank.name}</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      {tank.fish_species || 'No species'}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      {tank.fish_count} fish
                    </p>
                    {tank.notes && (
                      <p className="text-sm text-slate-500 mt-2 truncate max-w-[200px]">
                        {tank.notes}
                      </p>
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
