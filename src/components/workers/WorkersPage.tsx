import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Search, UserCheck, UserX, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { WorkersList } from './WorkersList';
import { CreateWorkerModal } from './CreateWorkerModal';
import { EditWorkerModal } from './EditWorkerModal';
import { WorkerDetailModal } from './WorkerDetailModal';
import { useCleaners } from '@/hooks/useCleaners';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Cleaner } from '@/types/calendar';

type WorkerStatusFilter = 'all' | 'active' | 'inactive';

export default function WorkersPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Cleaner | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<Cleaner | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<WorkerStatusFilter>('all');
  const isMobile = useIsMobile();

  const { cleaners, isLoading } = useCleaners();

  const totalActiveWorkers = useMemo(
    () => cleaners.filter((worker) => worker.isActive).length,
    [cleaners]
  );
  const totalInactiveWorkers = cleaners.length - totalActiveWorkers;

  const filteredWorkers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return cleaners.filter((worker) => {
      const matchesSearch = !term
        || worker.name.toLowerCase().includes(term)
        || worker.email?.toLowerCase().includes(term)
        || worker.telefono?.toLowerCase().includes(term)
        || worker.category?.toLowerCase().includes(term);

      if (!matchesSearch) return false;
      if (statusFilter === 'active') return worker.isActive;
      if (statusFilter === 'inactive') return !worker.isActive;
      return true;
    });
  }, [cleaners, searchTerm, statusFilter]);

  const activeWorkers = filteredWorkers.filter((worker) => worker.isActive);
  const inactiveWorkers = filteredWorkers.filter((worker) => !worker.isActive);
  const showActiveWorkers = statusFilter !== 'inactive';
  const showInactiveWorkers = statusFilter !== 'active';

  const handleEditWorker = (worker: Cleaner) => {
    setEditingWorker(worker);
  };

  const handleViewWorker = (worker: Cleaner) => {
    setSelectedWorker(worker);
  };

  const modalElements = (
    <>
      <CreateWorkerModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
      />

      <EditWorkerModal
        worker={editingWorker}
        open={!!editingWorker}
        onOpenChange={(open) => !open && setEditingWorker(null)}
      />

      <WorkerDetailModal
        worker={selectedWorker}
        open={!!selectedWorker}
        onOpenChange={(open) => !open && setSelectedWorker(null)}
      />
    </>
  );

  if (isMobile) {
    return (
      <div className="min-h-screen bg-slate-50 pb-4">
        <div className="mx-auto max-w-md space-y-4 px-4 py-4">
          <header className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Equipo</p>
                <h1 className="text-2xl font-bold text-slate-950">Trabajadores</h1>
                <p className="text-sm text-muted-foreground">Gestiona tu equipo de limpieza</p>
              </div>
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                size="icon"
                className="h-11 w-11 shrink-0 rounded-xl"
                aria-label="Nuevo trabajador"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>

            <Card className="border-0 bg-slate-950 text-white shadow-lg">
              <CardContent className="p-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-2xl font-bold">{cleaners.length}</div>
                    <div className="text-[11px] text-slate-300">Total</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-emerald-300">{totalActiveWorkers}</div>
                    <div className="text-[11px] text-slate-300">Activos</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-300">{totalInactiveWorkers}</div>
                    <div className="text-[11px] text-slate-300">Inactivos</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </header>

          <section className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, telefono, email..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="h-11 rounded-xl bg-white pl-10"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-xl bg-white p-1 shadow-sm">
              <StatusFilterButton
                active={statusFilter === 'all'}
                onClick={() => setStatusFilter('all')}
                label="Todos"
                count={cleaners.length}
              />
              <StatusFilterButton
                active={statusFilter === 'active'}
                onClick={() => setStatusFilter('active')}
                label="Activos"
                count={totalActiveWorkers}
                icon={UserCheck}
              />
              <StatusFilterButton
                active={statusFilter === 'inactive'}
                onClick={() => setStatusFilter('inactive')}
                label="Inactivos"
                count={totalInactiveWorkers}
                icon={UserX}
              />
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-950">
                {statusFilter === 'active'
                  ? `Activos (${filteredWorkers.length})`
                  : statusFilter === 'inactive'
                    ? `Inactivos (${filteredWorkers.length})`
                    : `Resultados (${filteredWorkers.length})`}
              </h2>
              {searchTerm && (
                <Button variant="ghost" size="sm" onClick={() => setSearchTerm('')}>
                  Limpiar
                </Button>
              )}
            </div>

            <WorkersList
              workers={filteredWorkers}
              isLoading={isLoading}
              onEditWorker={handleEditWorker}
              onViewWorker={handleViewWorker}
            />
          </section>
        </div>

        {modalElements}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card px-4 py-4 sm:px-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon" className="h-8 w-8 sm:hidden">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="hidden sm:flex">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver al menu
              </Button>
            </Link>
            <div>
              <h1 className="flex items-center gap-2 text-lg font-bold text-foreground sm:text-2xl">
                <Users className="h-5 w-5 sm:h-6 sm:w-6" />
                Trabajadores
              </h1>
              <p className="hidden text-sm text-muted-foreground sm:block">
                Administra tu equipo de limpieza y arrastra para reordenar
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-10 sm:w-64"
              />
            </div>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              size="sm"
              className="flex items-center gap-1 whitespace-nowrap sm:gap-2"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nuevo Trabajador</span>
              <span className="sm:hidden">Nuevo</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto space-y-4 p-3 sm:space-y-6 sm:p-6">
        <div className="grid grid-cols-3 gap-2 sm:gap-6">
          <Card>
            <CardHeader className="px-3 pb-1 pt-3 sm:px-6 sm:pb-2 sm:pt-6">
              <CardTitle className="text-xs font-medium text-muted-foreground sm:text-sm">Total</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
              <div className="text-xl font-bold text-foreground sm:text-2xl">{cleaners.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="px-3 pb-1 pt-3 sm:px-6 sm:pb-2 sm:pt-6">
              <CardTitle className="text-xs font-medium text-muted-foreground sm:text-sm">Activos</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
              <div className="text-xl font-bold text-green-600 sm:text-2xl">{totalActiveWorkers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="px-3 pb-1 pt-3 sm:px-6 sm:pb-2 sm:pt-6">
              <CardTitle className="text-xs font-medium text-muted-foreground sm:text-sm">Inactivos</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
              <div className="text-xl font-bold text-destructive sm:text-2xl">{totalInactiveWorkers}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Vista de trabajadores</p>
              <p className="text-xs text-muted-foreground">
                Cambia entre activos, inactivos o todos sin perder el historial.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted p-1 sm:w-[360px]">
              <StatusFilterButton
                active={statusFilter === 'all'}
                onClick={() => setStatusFilter('all')}
                label="Todos"
                count={cleaners.length}
              />
              <StatusFilterButton
                active={statusFilter === 'active'}
                onClick={() => setStatusFilter('active')}
                label="Activos"
                count={totalActiveWorkers}
                icon={UserCheck}
              />
              <StatusFilterButton
                active={statusFilter === 'inactive'}
                onClick={() => setStatusFilter('inactive')}
                label="Inactivos"
                count={totalInactiveWorkers}
                icon={UserX}
              />
            </div>
          </CardContent>
        </Card>

        {showActiveWorkers && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Trabajadores Activos ({activeWorkers.length})</CardTitle>
                <p className="text-sm text-muted-foreground">Arrastra las filas para reordenar</p>
              </div>
            </CardHeader>
            <CardContent>
              <WorkersList
                workers={activeWorkers}
                isLoading={isLoading}
                onEditWorker={handleEditWorker}
                onViewWorker={handleViewWorker}
              />
            </CardContent>
          </Card>
        )}

        {showInactiveWorkers && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-muted-foreground">
                Trabajadores Inactivos ({inactiveWorkers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WorkersList
                workers={inactiveWorkers}
                isLoading={isLoading}
                onEditWorker={handleEditWorker}
                onViewWorker={handleViewWorker}
              />
            </CardContent>
          </Card>
        )}

        {modalElements}
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
        'rounded-lg px-2 py-2 text-center text-xs font-medium transition-colors',
        active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600'
      )}
    >
      <span className="flex items-center justify-center gap-1">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </span>
      <span className={cn('mt-0.5 block text-[11px]', active ? 'text-blue-100' : 'text-muted-foreground')}>
        {count}
      </span>
    </button>
  );
}
