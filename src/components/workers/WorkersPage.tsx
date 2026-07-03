import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MailWarning, Plus, Search, UserCheck, UserX, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WorkersList } from './WorkersList';
import { CreateWorkerModal } from './CreateWorkerModal';
import { WorkerDetailModal, WorkerDetailPanel } from './WorkerDetailModal';
import { useCleaners } from '@/hooks/useCleaners';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Cleaner } from '@/types/calendar';

type WorkerStatusFilter = 'all' | 'active' | 'inactive';
type WorkerRegistroFilter = 'all' | 'linked' | 'manual' | 'without-access';

export default function WorkersPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<WorkerStatusFilter>('active');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [registroFilter, setRegistroFilter] = useState<WorkerRegistroFilter>('all');
  const isMobile = useIsMobile();

  const { cleaners, isLoading } = useCleaners();
  const totalActiveWorkers = useMemo(() => cleaners.filter((worker) => worker.isActive).length, [cleaners]);
  const totalInactiveWorkers = cleaners.length - totalActiveWorkers;
  const workersWithoutAccess = useMemo(
    () => cleaners.filter((worker) => worker.isActive && !worker.user_id).length,
    [cleaners],
  );

  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set(cleaners.map((worker) => worker.category?.trim()).filter((category): category is string => Boolean(category))),
      ).sort((a, b) => a.localeCompare(b, 'es')),
    [cleaners],
  );

  const filteredWorkers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return cleaners.filter((worker) => {
      const matchesSearch =
        !term ||
        worker.name.toLowerCase().includes(term) ||
        worker.email?.toLowerCase().includes(term) ||
        worker.telefono?.toLowerCase().includes(term) ||
        worker.category?.toLowerCase().includes(term) ||
        worker.dni?.toLowerCase().includes(term) ||
        worker.externalId?.toLowerCase().includes(term);

      if (!matchesSearch) return false;
      if (statusFilter === 'active' && !worker.isActive) return false;
      if (statusFilter === 'inactive' && worker.isActive) return false;
      if (categoryFilter !== 'all' && worker.category !== categoryFilter) return false;
      if (registroFilter === 'linked' && !worker.externalId) return false;
      if (registroFilter === 'manual' && worker.externalId) return false;
      if (registroFilter === 'without-access' && worker.user_id) return false;
      return true;
    });
  }, [cleaners, searchTerm, statusFilter, categoryFilter, registroFilter]);

  const selectedWorker = useMemo(
    () => cleaners.find((worker) => worker.id === selectedWorkerId) || null,
    [cleaners, selectedWorkerId],
  );
  const desktopWorker = selectedWorker || filteredWorkers[0] || null;
  const hasExtraFilters = categoryFilter !== 'all' || registroFilter !== 'all';

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('active');
    setCategoryFilter('all');
    setRegistroFilter('all');
  };

  const handleViewWorker = (worker: Cleaner) => {
    setSelectedWorkerId(worker.id);
  };

  const createModal = (
    <CreateWorkerModal
      open={isCreateModalOpen}
      onOpenChange={setIsCreateModalOpen}
    />
  );

  if (isMobile) {
    return (
      <div className="min-h-dvh bg-slate-50 pb-24">
        <div className="mx-auto max-w-md space-y-4 px-4 py-4">
          <MobileHeader onCreate={() => setIsCreateModalOpen(true)} />

          <WorkerStats
            total={cleaners.length}
            active={totalActiveWorkers}
            inactive={totalInactiveWorkers}
            withoutAccess={workersWithoutAccess}
            mobile
          />

          <WorkerFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            categoryOptions={categoryOptions}
            categoryFilter={categoryFilter}
            onCategoryChange={setCategoryFilter}
            registroFilter={registroFilter}
            onRegistroChange={setRegistroFilter}
            total={cleaners.length}
            active={totalActiveWorkers}
            inactive={totalInactiveWorkers}
            compact
          />

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-950">{getListTitle(statusFilter, filteredWorkers.length)}</h2>
              {(searchTerm || hasExtraFilters || statusFilter !== 'active') && (
                <Button variant="ghost" size="sm" onClick={resetFilters}>Limpiar</Button>
              )}
            </div>
            <WorkersList
              workers={filteredWorkers}
              isLoading={isLoading}
              selectedWorkerId={selectedWorkerId}
              onViewWorker={handleViewWorker}
            />
          </section>
        </div>

        {createModal}
        <WorkerDetailModal
          worker={selectedWorker}
          open={!!selectedWorkerId}
          onOpenChange={(open) => !open && setSelectedWorkerId(null)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex flex-col justify-between gap-3 2xl:flex-row 2xl:items-center">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver al menú
              </Button>
            </Link>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#310984]">Equipo operativo</p>
              <h1 className="flex items-center gap-2 text-2xl font-black text-slate-950">
                <Users className="h-6 w-6" />
                Trabajadores
              </h1>
              <p className="text-sm text-slate-500">
                Edita datos, contratos, ausencias y acceso desde una única ficha.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setIsCreateModalOpen(true)} className="rounded-xl">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo trabajador
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1800px] space-y-4 p-4 sm:p-6">
        <WorkerStats
          total={cleaners.length}
          active={totalActiveWorkers}
          inactive={totalInactiveWorkers}
          withoutAccess={workersWithoutAccess}
        />

        <div className="grid gap-4 2xl:grid-cols-[440px_minmax(0,1fr)]">
          <Card className="h-fit border-0 shadow-sm 2xl:sticky 2xl:top-4">
            <CardHeader className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{getListTitle(statusFilter, filteredWorkers.length)}</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">Busca, filtra y selecciona una ficha para editarla.</p>
                </div>
                {(searchTerm || hasExtraFilters || statusFilter !== 'active') && (
                  <Button variant="ghost" size="sm" onClick={resetFilters}>Limpiar</Button>
                )}
              </div>
              <WorkerFilters
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                statusFilter={statusFilter}
                onStatusChange={setStatusFilter}
                categoryOptions={categoryOptions}
                categoryFilter={categoryFilter}
                onCategoryChange={setCategoryFilter}
                registroFilter={registroFilter}
                onRegistroChange={setRegistroFilter}
                total={cleaners.length}
                active={totalActiveWorkers}
                inactive={totalInactiveWorkers}
              />
            </CardHeader>
            <CardContent>
              <WorkersList
                workers={filteredWorkers}
                isLoading={isLoading}
                selectedWorkerId={desktopWorker?.id || selectedWorkerId}
                onViewWorker={handleViewWorker}
              />
            </CardContent>
          </Card>

          {desktopWorker ? (
            <WorkerDetailPanel worker={desktopWorker} className="min-h-[720px]" />
          ) : (
            <Card className="border-dashed bg-white shadow-sm">
              <CardContent className="flex min-h-[520px] flex-col items-center justify-center p-8 text-center">
                <Users className="h-12 w-12 text-slate-300" />
                <h2 className="mt-4 text-xl font-black text-slate-950">Selecciona una trabajadora</h2>
                <p className="mt-2 max-w-md text-sm text-slate-500">
                  Desde aquí podrás editar nombre, email, teléfono, contratos, ausencias y datos operativos sin abrir pantallas duplicadas.
                </p>
                <Button onClick={() => setIsCreateModalOpen(true)} className="mt-5 rounded-xl">
                  <Plus className="mr-2 h-4 w-4" />
                  Crear trabajadora
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {createModal}
      </div>
    </div>
  );
}

function MobileHeader({ onCreate }: { onCreate: () => void }) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#310984]">Equipo operativo</p>
        <h1 className="text-2xl font-black text-slate-950">Trabajadores</h1>
        <p className="text-sm text-slate-500">Ficha, contratos y ausencias.</p>
      </div>
      <Button onClick={onCreate} size="icon" className="h-11 w-11 shrink-0 rounded-xl" aria-label="Nuevo trabajador">
        <Plus className="h-5 w-5" />
      </Button>
    </header>
  );
}

function WorkerStats({
  total,
  active,
  inactive,
  withoutAccess,
  mobile = false,
}: {
  total: number;
  active: number;
  inactive: number;
  withoutAccess: number;
  mobile?: boolean;
}) {
  return (
    <div className={cn('grid gap-2', mobile ? 'grid-cols-2' : 'grid-cols-4')}>
      <StatCard label="Total" value={total} helper="en la sede" />
      <StatCard label="Activas" value={active} helper="asignables" tone="ok" />
      <StatCard label="Inactivas" value={inactive} helper="fuera de uso" tone="muted" />
      <StatCard label="Sin acceso" value={withoutAccess} helper="sin usuario" tone="warning" icon={MailWarning} />
    </div>
  );
}

function StatCard({
  label,
  value,
  helper,
  tone = 'neutral',
  icon: Icon,
}: {
  label: string;
  value: number;
  helper: string;
  tone?: 'neutral' | 'ok' | 'warning' | 'muted';
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const toneClass = {
    neutral: 'border-sky-200 bg-sky-50 text-sky-950',
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    warning: 'border-amber-200 bg-amber-50 text-amber-950',
    muted: 'border-slate-200 bg-white text-slate-950',
  }[tone];

  return (
    <Card className={cn('border shadow-sm', toneClass)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] opacity-70">{label}</p>
            <p className="mt-1 text-2xl font-black">{value}</p>
            <p className="text-xs opacity-70">{helper}</p>
          </div>
          {Icon && <Icon className="h-5 w-5 opacity-70" />}
        </div>
      </CardContent>
    </Card>
  );
}

function WorkerFilters({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusChange,
  categoryOptions,
  categoryFilter,
  onCategoryChange,
  registroFilter,
  onRegistroChange,
  total,
  active,
  inactive,
  compact = false,
}: {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: WorkerStatusFilter;
  onStatusChange: (value: WorkerStatusFilter) => void;
  categoryOptions: string[];
  categoryFilter: string;
  onCategoryChange: (value: string) => void;
  registroFilter: WorkerRegistroFilter;
  onRegistroChange: (value: WorkerRegistroFilter) => void;
  total: number;
  active: number;
  inactive: number;
  compact?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Buscar por nombre, teléfono, email, DNI..."
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          className="h-11 rounded-xl bg-white pl-10"
        />
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1">
        <StatusFilterButton active={statusFilter === 'all'} onClick={() => onStatusChange('all')} label="Todos" count={total} />
        <StatusFilterButton active={statusFilter === 'active'} onClick={() => onStatusChange('active')} label="Activos" count={active} icon={UserCheck} />
        <StatusFilterButton active={statusFilter === 'inactive'} onClick={() => onStatusChange('inactive')} label="Inactivos" count={inactive} icon={UserX} />
      </div>

      <div className={cn('grid gap-2', compact ? 'grid-cols-2' : 'grid-cols-1 lg:grid-cols-2')}>
        <Select value={categoryFilter} onValueChange={onCategoryChange}>
          <SelectTrigger className="h-10 rounded-xl bg-white text-xs sm:text-sm">
            <SelectValue placeholder="Rol/categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categoryOptions.map((category) => (
              <SelectItem key={category} value={category}>{category}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={registroFilter} onValueChange={(value) => onRegistroChange(value as WorkerRegistroFilter)}>
          <SelectTrigger className="h-10 rounded-xl bg-white text-xs sm:text-sm">
            <SelectValue placeholder="Acceso / REGISTRO" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los registros</SelectItem>
            <SelectItem value="without-access">Sin acceso a la app</SelectItem>
            <SelectItem value="linked">Vinculados a REGISTRO</SelectItem>
            <SelectItem value="manual">Manual / sin REGISTRO</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function StatusFilterButton({
  active,
  onClick,
  label,
  count,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg px-2 py-2 text-center text-xs font-bold transition-colors',
        active ? 'bg-[#310984] text-white shadow-sm' : 'text-slate-600 hover:bg-white',
      )}
    >
      <span className="flex items-center justify-center gap-1">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </span>
      <span className={cn('mt-0.5 block text-[11px]', active ? 'text-violet-100' : 'text-slate-500')}>{count}</span>
    </button>
  );
}

function getListTitle(statusFilter: WorkerStatusFilter, count: number) {
  if (statusFilter === 'active') return `Trabajadoras activas (${count})`;
  if (statusFilter === 'inactive') return `Trabajadoras inactivas (${count})`;
  return `Trabajadoras (${count})`;
}
