'use client';

import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '@/components/ui/Button';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { Plus, Heart, X, Upload, PawPrint } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type AnimalSpecies = 'cat' | 'kitten' | 'bird' | 'dog' | 'rabbit' | 'reptile' | 'other';
type AnimalStatus = 'available' | 'reserved' | 'adopted';

type Animal = {
  id: string;
  organization_id: string;
  slug: string;
  name: string;
  species: AnimalSpecies;
  breed: string | null;
  age_months: number | null;
  sex: 'male' | 'female' | 'unknown';
  price: number | null;
  status: AnimalStatus;
  hand_raised: boolean | null;
  microchipped: boolean;
  vaccinated: boolean;
  notes: string | null;
  photos: string[];
  created_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAge(months: number | null): string {
  if (months == null || months < 0) return '';
  if (months < 1) return 'Less than 1 month';
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${months} month${months !== 1 ? 's' : ''}`;
  if (rem === 0) return `${years} year${years !== 1 ? 's' : ''}`;
  return `${years} year${years !== 1 ? 's' : ''} ${rem} month${rem !== 1 ? 's' : ''}`;
}

function toMonths(value: string, unit: 'weeks' | 'months' | 'years'): number | null {
  const n = parseInt(value);
  if (isNaN(n) || n < 0) return null;
  if (unit === 'weeks') return Math.round(n / 4.33);
  if (unit === 'months') return n;
  return n * 12;
}

const STATUS_CONFIG: Record<AnimalStatus, { label: string; pill: string; badge: string }> = {
  available: {
    label: 'Available',
    pill: 'bg-green-100 text-green-800 border-green-200',
    badge: 'bg-green-500 text-white',
  },
  reserved: {
    label: 'Reserved',
    pill: 'bg-amber-100 text-amber-800 border-amber-200',
    badge: 'bg-amber-500 text-white',
  },
  adopted: {
    label: 'Adopted',
    pill: 'bg-slate-100 text-slate-600 border-slate-200',
    badge: 'bg-slate-400 text-white',
  },
};

const SPECIES_OPTIONS: { value: AnimalSpecies; label: string; emoji: string }[] = [
  { value: 'kitten', label: 'Kitten', emoji: '🐱' },
  { value: 'bird', label: 'Bird', emoji: '🐦' },
  { value: 'dog', label: 'Dog', emoji: '🐶' },
  { value: 'rabbit', label: 'Rabbit', emoji: '🐇' },
  { value: 'reptile', label: 'Reptile', emoji: '🦎' },
  { value: 'other', label: 'Other', emoji: '❓' },
];

const SPECIES_FILTER_PILLS = [
  { value: 'all', label: 'All' },
  { value: 'cats', label: 'Cats' },
  { value: 'bird', label: 'Birds' },
  { value: 'dog', label: 'Dogs' },
  { value: 'rabbit', label: 'Rabbits' },
  { value: 'other', label: 'Other' },
];

function matchesSpeciesFilter(species: AnimalSpecies, filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === 'cats') return species === 'cat' || species === 'kitten';
  if (filter === 'other') return !['cat', 'kitten', 'bird', 'dog', 'rabbit'].includes(species);
  return species === filter;
}

async function fetchAnimals(organizationId: string): Promise<Animal[]> {
  const res = await fetch(`/api/animals?organizationId=${organizationId}`);
  if (!res.ok) return [];
  const d = await res.json();
  return d.animals ?? [];
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-amber-500' : 'bg-slate-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// ─── Animal Card ──────────────────────────────────────────────────────────────

function AnimalCard({ animal, onClick }: { animal: Animal; onClick: () => void }) {
  const age = formatAge(animal.age_months);
  const speciesOption = SPECIES_OPTIONS.find((s) => s.value === animal.species)
    ?? { emoji: '🐾', label: animal.species };
  const statusCfg = STATUS_CONFIG[animal.status];

  return (
    <div
      className="bg-white rounded-2xl border border-amber-100/80 shadow-warm-sm overflow-hidden flex flex-col cursor-pointer hover:shadow-md hover:border-amber-300 transition"
      onClick={onClick}
    >
      {/* Photo or placeholder */}
      <div className="relative aspect-video">
        {animal.photos.length > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={animal.photos[0]}
            alt={animal.name}
            className="w-full h-full object-cover rounded-t-xl"
          />
        ) : (
          <div className="w-full h-full bg-amber-50 flex items-center justify-center rounded-t-xl">
            <PawPrint className="w-12 h-12 text-amber-300" />
          </div>
        )}
        {/* Status badge */}
        <span
          className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-semibold ${statusCfg.badge}`}
        >
          {statusCfg.label}
        </span>
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div>
          <h3 className="font-semibold text-stone-800 text-base leading-snug">{animal.name}</h3>
          <p className="text-sm text-stone-500">
            {speciesOption.emoji} {animal.breed || speciesOption.label}
          </p>
        </div>

        {age && <p className="text-sm text-stone-600">{age}</p>}

        {animal.price != null ? (
          <p className="text-sm font-bold text-amber-600">${animal.price.toFixed(2)}</p>
        ) : (
          <p className="text-sm text-stone-500 italic">Contact us</p>
        )}

        {/* Badges */}
        <div className="flex flex-wrap gap-1 mt-auto pt-1">
          {(animal.species === 'bird' || animal.species === 'kitten' || animal.species === 'cat') &&
            animal.hand_raised && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Hand Raised
              </span>
            )}
          {animal.vaccinated && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Vaccinated
            </span>
          )}
          {animal.microchipped && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              Microchipped
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Animal Form Modal (Add + Edit) ───────────────────────────────────────────

function AnimalFormModal({
  organizationId,
  animal,
  onClose,
  onSuccess,
}: {
  organizationId: string;
  animal?: Animal;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!animal;

  function initialAgeValue(months: number | null): string {
    if (months == null) return '';
    if (months % 12 === 0 && months >= 12) return String(months / 12);
    return String(months);
  }
  function initialAgeUnit(months: number | null): 'weeks' | 'months' | 'years' {
    if (months != null && months % 12 === 0 && months >= 12) return 'years';
    return 'months';
  }

  const [species, setSpecies] = useState<AnimalSpecies>(animal?.species ?? 'kitten');
  const [name, setName] = useState(animal?.name ?? '');
  const [breed, setBreed] = useState(animal?.breed ?? '');
  const [ageValue, setAgeValue] = useState(initialAgeValue(animal?.age_months ?? null));
  const [ageUnit, setAgeUnit] = useState<'weeks' | 'months' | 'years'>(initialAgeUnit(animal?.age_months ?? null));
  const [sex, setSex] = useState<'male' | 'female' | 'unknown'>(animal?.sex ?? 'unknown');
  const [price, setPrice] = useState(animal?.price != null ? String(animal.price) : '');
  const [status, setStatus] = useState<AnimalStatus>(animal?.status ?? 'available');
  const [handRaised, setHandRaised] = useState(animal?.hand_raised ?? false);
  const [microchipped, setMicrochipped] = useState(animal?.microchipped ?? false);
  const [vaccinated, setVaccinated] = useState(animal?.vaccinated ?? false);
  const [notes, setNotes] = useState(animal?.notes ?? '');
  const [existingPhotos, setExistingPhotos] = useState<string[]>(animal?.photos ?? []);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | File[]) => {
    const newFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    setPhotoFiles((prev) => [...prev, ...newFiles]);
    setPhotoPreviews((prev) => [
      ...prev,
      ...newFiles.map((f) => URL.createObjectURL(f)),
    ]);
  }, []);

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photoPreviews[index]);
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    setError('');

    try {
      // Upload new photos
      const uploadedUrls: string[] = [];
      for (const file of photoFiles) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('organizationId', organizationId);
        const res = await fetch('/api/animals/photos', { method: 'POST', body: fd });
        if (res.ok) {
          const d = await res.json();
          uploadedUrls.push(d.url);
        }
      }

      const payload = {
        organizationId,
        name: name.trim(),
        species,
        breed: breed.trim() || null,
        age_months: ageValue ? toMonths(ageValue, ageUnit) : null,
        sex,
        price: price || null,
        status,
        hand_raised: species === 'bird' ? handRaised : null,
        microchipped,
        vaccinated,
        notes: notes.trim() || null,
        photos: [...existingPhotos, ...uploadedUrls],
      };

      const res = isEdit
        ? await fetch(`/api/animals/${animal.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/animals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Failed to save animal');
        return;
      }

      onSuccess();
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const labelCls = 'block text-sm font-medium text-stone-700 mb-1';
  const inputCls = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300';

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-6" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-stone-800">{isEdit ? 'Edit Animal' : 'Add Animal'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* 1. Species */}
          <div>
            <label className={labelCls}>Species</label>
            <div className="flex flex-wrap gap-2">
              {SPECIES_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSpecies(opt.value)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition ${
                    species === opt.value
                      ? 'bg-amber-100 border-amber-400 text-amber-900'
                      : 'border-slate-200 text-stone-600 hover:bg-slate-50'
                  }`}
                >
                  <span>{opt.emoji}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Name */}
          <div>
            <label className={labelCls}>
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Luna"
              required
              className={inputCls}
            />
          </div>

          {/* 3. Breed */}
          <div>
            <label className={labelCls}>Breed (optional)</label>
            <input
              type="text"
              value={breed}
              onChange={(e) => setBreed(e.target.value)}
              placeholder="e.g. Siamese"
              className={inputCls}
            />
          </div>

          {/* 4. Age */}
          <div>
            <label className={labelCls}>Age (optional)</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                value={ageValue}
                onChange={(e) => setAgeValue(e.target.value)}
                placeholder="e.g. 3"
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
              <select
                value={ageUnit}
                onChange={(e) => setAgeUnit(e.target.value as 'weeks' | 'months' | 'years')}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
              >
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
                <option value="years">Years</option>
              </select>
            </div>
          </div>

          {/* 5. Sex */}
          <div>
            <label className={labelCls}>Sex</label>
            <div className="flex gap-2">
              {(['male', 'female', 'unknown'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSex(s)}
                  className={`flex-1 py-2 rounded-xl border text-sm font-medium transition ${
                    sex === s
                      ? 'bg-amber-100 border-amber-400 text-amber-900'
                      : 'border-slate-200 text-stone-600 hover:bg-slate-50'
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* 6. Price */}
          <div>
            <label className={labelCls}>Price (optional)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-sm">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </div>
          </div>

          {/* 7. Status */}
          <div>
            <label className={labelCls}>Status</label>
            <div className="flex gap-2">
              {(['available', 'reserved', 'adopted'] as const).map((s) => {
                const cfg = STATUS_CONFIG[s];
                const isSelected = status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`flex-1 py-2 rounded-xl border text-sm font-medium transition ${
                      isSelected
                        ? s === 'available'
                          ? 'bg-green-100 border-green-400 text-green-900'
                          : s === 'reserved'
                            ? 'bg-amber-100 border-amber-400 text-amber-900'
                            : 'bg-slate-100 border-slate-400 text-slate-700'
                        : 'border-slate-200 text-stone-600 hover:bg-slate-50'
                    }`}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 8. Hand Raised (birds only) */}
          {species === 'bird' && (
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium text-stone-700">Hand Raised?</p>
                <p className="text-xs text-stone-500">Raised by humans from birth</p>
              </div>
              <Toggle checked={handRaised} onChange={setHandRaised} />
            </div>
          )}

          {/* 9. Microchipped */}
          <div className="flex items-center justify-between py-1">
            <p className="text-sm font-medium text-stone-700">Microchipped</p>
            <Toggle checked={microchipped} onChange={setMicrochipped} />
          </div>

          {/* 10. Vaccinated */}
          <div className="flex items-center justify-between py-1">
            <p className="text-sm font-medium text-stone-700">Vaccinated</p>
            <Toggle checked={vaccinated} onChange={setVaccinated} />
          </div>

          {/* 11. Notes */}
          <div>
            <label className={labelCls}>Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional details..."
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* 12. Photos */}
          <div>
            <label className={labelCls}>Photos</label>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
                isDragging
                  ? 'border-amber-400 bg-amber-50'
                  : 'border-slate-200 hover:border-amber-300 hover:bg-amber-50/50'
              }`}
            >
              <Upload className="w-6 h-6 text-stone-400 mx-auto mb-2" />
              <p className="text-sm text-stone-500">Drag & drop or click to upload</p>
              <p className="text-xs text-stone-400 mt-1">JPG, PNG, WEBP</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && addFiles(e.target.files)}
              />
            </div>

            {(existingPhotos.length > 0 || photoPreviews.length > 0) && (
              <div className="flex flex-wrap gap-2 mt-3">
                {existingPhotos.map((url, i) => (
                  <div key={`existing-${i}`} className="relative w-20 h-20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt=""
                      className="w-20 h-20 object-cover rounded-lg border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => setExistingPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {photoPreviews.map((url, i) => (
                  <div key={`new-${i}`} className="relative w-20 h-20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt=""
                      className="w-20 h-20 object-cover rounded-lg border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={!name.trim() || isSubmitting}>
              {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Animal'}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnimalsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const organizationId = user?.organization_id ?? '';
  const [speciesFilter, setSpeciesFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingAnimal, setEditingAnimal] = useState<Animal | null>(null);

  const { data: animals = [], isLoading } = useQuery({
    queryKey: ['animals', organizationId],
    queryFn: () => fetchAnimals(organizationId),
    enabled: !!organizationId,
  });

  const filtered = animals.filter((a) => {
    const speciesMatch = matchesSpeciesFilter(a.species, speciesFilter);
    const statusMatch = statusFilter === 'all' || a.status === statusFilter;
    return speciesMatch && statusMatch;
  });

  const pillBase = 'px-3 py-1.5 rounded-full text-sm font-medium border transition cursor-pointer';
  const pillActive = 'bg-amber-100 border-amber-400 text-amber-900';
  const pillInactive = 'bg-white border-slate-200 text-stone-600 hover:bg-slate-50';

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Heart className="w-6 h-6 text-amber-500" />
            Animals for Adoption
          </h1>
          <p className="text-slate-500 mt-1">
            {animals.length} animal{animals.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Animal
        </Button>
      </header>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {SPECIES_FILTER_PILLS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setSpeciesFilter(value)}
              className={`${pillBase} ${speciesFilter === value ? pillActive : pillInactive}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(['all', 'available', 'reserved', 'adopted'] as const).map((s) => {
            const label = s === 'all' ? 'All Statuses' : STATUS_CONFIG[s].label;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`${pillBase} ${statusFilter === s ? pillActive : pillInactive}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-amber-100/80 shadow-warm-sm p-12 text-center">
          <PawPrint className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          {animals.length === 0 ? (
            <>
              <p className="text-slate-500 mb-4">No animals registered yet</p>
              <Button onClick={() => setShowModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add your first animal
              </Button>
            </>
          ) : (
            <p className="text-slate-500">No animals match the current filters</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((animal) => (
            <AnimalCard key={animal.id} animal={animal} onClick={() => setEditingAnimal(animal)} />
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showModal && organizationId && (
        <AnimalFormModal
          organizationId={organizationId}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['animals', organizationId] });
            setShowModal(false);
          }}
        />
      )}

      {/* Edit Modal */}
      {editingAnimal && organizationId && (
        <AnimalFormModal
          organizationId={organizationId}
          animal={editingAnimal}
          onClose={() => setEditingAnimal(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['animals', organizationId] });
            setEditingAnimal(null);
          }}
        />
      )}
    </div>
  );
}
