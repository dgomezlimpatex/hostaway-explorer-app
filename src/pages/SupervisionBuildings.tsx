import { AlertTriangle, Building2, CalendarDays, CheckCircle2, ClipboardCheck, Cloud, CloudOff, Loader2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatMadridDate } from '@/utils/date';
import { useBuildingSupervisionWorkspace } from '@/features/supervision/useBuildingSupervisionWorkspace';
import type { BuildingAgendaBuildingResult, BuildingAgendaItem } from '@/features/supervision/buildingAgenda';
import type { SupervisionRoute, SupervisionStop } from '@/features/supervision/types';
import { BuildingSupervisionCard } from '@/components/supervision/BuildingSupervisionCard';
import { ApartmentReviewSheet } from '@/components/supervision/ApartmentReviewSheet';

const displayDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

interface ReviewSelection {
  item: BuildingAgendaItem;
  route: SupervisionRoute;
  stop: SupervisionStop;
}

const SupervisionBuildings = () => {
  const [date, setDate] = useState(formatMadridDate(new Date()));
  const [selectedReview, setSelectedReview] = useState<ReviewSelection | null>(null);
  const [preparingBuildingId, setPreparingBuildingId] = useState<string | null>(null);
  const workspace = useBuildingSupervisionWorkspace(date);

  const openReview = async (item: BuildingAgendaItem) => {
    const building = workspace.agenda?.buildings.find((candidate) => candidate.id === item.buildingId);
    if (!building) return;
    setPreparingBuildingId(building.id);
    try {
      if (item.workItemId) await workspace.updateWorkItemStatus({ workItemId: item.workItemId, status: 'in_progress' });
      const prepared = await workspace.prepareBuilding(building);
      const stop = prepared.stops.find((candidate) => candidate.property_id === item.propertyId);
      if (!stop) throw new Error('No se pudo preparar la parada de esta propiedad.');
      setSelectedReview({ item, route: prepared.route, stop });
    } finally {
      setPreparingBuildingId(null);
    }
  };

  const deferItem = async (item: BuildingAgendaItem) => {
    if (!item.workItemId) return;
    const reason = window.prompt('¿Por qué se aplaza esta comprobación?');
    if (!reason?.trim()) return;
    await workspace.updateWorkItemStatus({ workItemId: item.workItemId, status: 'deferred', reason: reason.trim() });
  };

  if (!workspace.sedeId) return <div className="p-6"><Alert><AlertTitle>Sin sede activa</AlertTitle><AlertDescription>Selecciona una sede para iniciar la supervisión.</AlertDescription></Alert></div>;
  if (workspace.isLoading) return <div className="flex min-h-[60vh] items-center justify-center gap-3"><Loader2 className="animate-spin" /> Preparando tu agenda de supervisión…</div>;

  const agenda = workspace.agenda || { date, buildings: [], pendingCount: 0, completedCount: 0, blockedCount: 0 };

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-3xl bg-[#310984] p-5 text-white shadow-lg sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">Centro operativo</p><h1 className="mt-1 text-3xl font-bold">Mi supervisión</h1><p className="mt-2 max-w-2xl text-sm text-violet-100">El sistema agrupa automáticamente tus edificios y te muestra solo las comprobaciones que necesitan atención.</p></div>
            <div className="flex items-center gap-2"><label className="flex items-center gap-2 text-sm text-violet-100"><CalendarDays className="h-4 w-4" /><span className="sr-only">Fecha</span><Input aria-label="Fecha de supervisión" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-[155px] bg-white text-slate-900" /></label><Button variant="secondary" onClick={() => void workspace.refresh()}><RefreshCw className="mr-2 h-4 w-4" />Actualizar</Button></div>
          </div>
          <p className="mt-4 text-sm text-violet-100">{workspace.activeSede?.nombre} · {displayDate(date)}</p>
        </header>

        {workspace.error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>No se pudo preparar la agenda</AlertTitle><AlertDescription>{workspace.error instanceof Error ? workspace.error.message : 'Revisa la conexión o la asignación de edificios.'}</AlertDescription></Alert>}

        <div className="flex items-center gap-2 text-xs text-slate-500">{workspace.storageMode === 'remote' || !workspace.storageMode ? <Cloud className="h-4 w-4 text-emerald-600" /> : <CloudOff className="h-4 w-4 text-amber-600" />}{workspace.storageMode === 'offline' ? 'Modo local: los cambios pendientes se sincronizarán al recuperar conexión.' : 'Agenda generada con datos sincronizados.'}</div>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Edificios asignados</p><p className="mt-1 text-2xl font-bold text-[#310984]">{agenda.buildings.length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Pendientes hoy</p><p className="mt-1 text-2xl font-bold text-amber-700">{agenda.pendingCount}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Completadas</p><p className="mt-1 text-2xl font-bold text-emerald-700">{agenda.completedCount}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Incidencias prioritarias</p><p className="mt-1 text-2xl font-bold text-red-700">{agenda.buildings.reduce((sum, building) => sum + building.items.filter((item) => item.type === 'incident').length, 0)}</p></CardContent></Card>
        </section>

        {agenda.buildings.length === 0 ? <Card><CardContent className="flex min-h-[260px] flex-col items-center justify-center gap-3 p-8 text-center"><Building2 className="h-12 w-12 text-[#310984]/40" /><h2 className="text-lg font-semibold text-slate-950">Todavía no tienes edificios asignados</h2><p className="max-w-md text-sm text-slate-500">Cuando administración te asigne un edificio, sus propiedades y comprobaciones aparecerán aquí automáticamente.</p></CardContent></Card> : <section className="space-y-4"><div className="flex items-center justify-between"><div><h2 className="text-xl font-bold text-slate-950">Tus edificios</h2><p className="text-sm text-slate-500">No tienes que crear rutas ni añadir apartamentos manualmente.</p></div><Badge variant="outline" className="border-[#310984]/20 bg-white text-[#310984]"><ClipboardCheck className="mr-1 h-4 w-4" />Agenda automática</Badge></div>{agenda.buildings.map((building: BuildingAgendaBuildingResult) => <BuildingSupervisionCard key={building.id} building={building} onReview={(item) => void openReview(item)} onDefer={(item) => void deferItem(item)} isPreparing={preparingBuildingId === building.id} />)}</section>}

        <Card className="border-violet-100 bg-violet-50/60"><CardContent className="flex gap-3 p-4 text-sm text-violet-950"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#310984]" /><div><p className="font-semibold">¿Cómo se decide qué aparece?</p><p className="mt-1 text-violet-900/80">Las propiedades proceden de los edificios configurados. Se priorizan limpiezas terminadas, entradas próximas, devoluciones para repaso e incidencias abiertas.</p></div></CardContent></Card>
      </div>

      {selectedReview && workspace.user && <ApartmentReviewSheet item={selectedReview.item} route={selectedReview.route} stop={selectedReview.stop} userId={workspace.user.id} isSaving={workspace.isSaving} onSaveReview={workspace.saveReview} onUploadPhoto={workspace.uploadPhoto} onCreateIncident={workspace.createIncident} onCompleteWorkItem={(workItemId) => workspace.updateWorkItemStatus({ workItemId, status: 'completed' })} onClose={() => setSelectedReview(null)} onSaved={() => setSelectedReview(null)} />}
    </div>
  );
};

export default SupervisionBuildings;
