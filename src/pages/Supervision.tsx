import { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import { AlertTriangle, Check, ChevronDown, ChevronUp, ClipboardCheck, Cloud, CloudOff, Download, GripVertical, Home, Loader2, MapPin, Plus, RefreshCw, Send, Warehouse, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useSupervisionWorkspace } from '@/features/supervision/useSupervisionWorkspace';
import { formatMadridDate } from '@/utils/date';
import { buildChecklistSnapshot, calculateExpectedTableware, calculateSupervisionMetrics, getEntryMessage, getLatestOpenIncidentsByStop, getLatestReviewsByStop, getReviewStatusLabel, INCIDENT_CATEGORIES, INCIDENT_PRIORITY_LABELS, scoreCandidate, sortCandidates } from '@/features/supervision/domain';
import type { SupervisionIncidentPriority, SupervisionReviewType, SupervisionStop } from '@/features/supervision/types';
import type { Task } from '@/types/calendar';

const isoToday = () => formatMadridDate(new Date());
const displayDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const formatTime = (value?: string | null) => value ? (value.includes('T') ? value.slice(11, 16) : value.slice(0, 5)) : '—';

const stopLabel = (stop: SupervisionStop) => stop.label || stop.task?.propertyName || stop.task?.property || 'Parada sin nombre';

export default function SupervisionPage() {
  const { toast } = useToast();
  const [date, setDate] = useState(isoToday);
  const workspace = useSupervisionWorkspace(date);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [routeName, setRouteName] = useState('');
  const [storageLabel, setStorageLabel] = useState('');
  const [reviewStopId, setReviewStopId] = useState<string | null>(null);
  const [incidentStopId, setIncidentStopId] = useState<string | null>(null);
  const [reviewType, setReviewType] = useState<SupervisionReviewType>('quick');
  const [reviewResult, setReviewResult] = useState<'correct' | 'incorrect'>('correct');
  const [reviewAction, setReviewAction] = useState<'reviewed' | 'returned_for_rework'>('reviewed');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewFiles, setReviewFiles] = useState<File[]>([]);
  const [reworkReason, setReworkReason] = useState('');
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [capacity, setCapacity] = useState(4);
  const [manualTableware, setManualTableware] = useState('');
  const [incidentCategory, setIncidentCategory] = useState<string>(INCIDENT_CATEGORIES[0]);
  const [incidentPriority, setIncidentPriority] = useState<SupervisionIncidentPriority>('medium');
  const [incidentDescription, setIncidentDescription] = useState('');
  const [incidentTargetDate, setIncidentTargetDate] = useState('');

  const selectedRoute = workspace.routes.find((route) => route.id === selectedRouteId) || workspace.routes[0];
  const routeStops = useMemo(() => workspace.stops.filter((stop) => stop.route_id === selectedRoute?.id).sort((a, b) => a.sequence - b.sequence), [workspace.stops, selectedRoute?.id]);
  const reviewByStop = useMemo(() => getLatestReviewsByStop(workspace.reviews), [workspace.reviews]);
  const incidentByStop = useMemo(() => getLatestOpenIncidentsByStop(workspace.incidents), [workspace.incidents]);
  const reviewStop = routeStops.find((stop) => stop.id === reviewStopId);
  const incidentStop = routeStops.find((stop) => stop.id === incidentStopId);
  const latestReview = reviewStop ? reviewByStop.get(reviewStop.id) : undefined;
  const metrics = useMemo(() => calculateSupervisionMetrics(
    routeStops,
    workspace.reviews.filter((review) => review.route_id === selectedRoute?.id),
    workspace.incidents.filter((incident) => incident.route_id === selectedRoute?.id),
  ), [routeStops, workspace.reviews, workspace.incidents, selectedRoute?.id]);
  const candidates = useMemo(() => {
    const usedTaskIds = new Set(routeStops.map((stop) => stop.task_id).filter(Boolean));
    return sortCandidates(workspace.tasks.filter((task) => !usedTaskIds.has(task.id)).map((task) => scoreCandidate(task, {
      incidentCount: workspace.incidents.filter((incident) => incident.task_id === task.id && !['resolved', 'archived'].includes(incident.status)).length,
      negativeReviews: workspace.reviews.filter((review) => review.task_id === task.id && review.result === 'incorrect').length,
      reviewedRecently: workspace.reviews.some((review) => review.task_id === task.id && review.created_at.slice(0, 10) === date),
    })));
  }, [workspace.tasks, workspace.incidents, workspace.reviews, routeStops, date]);

  useEffect(() => {
    if (!selectedRouteId && workspace.routes[0]) setSelectedRouteId(workspace.routes[0].id);
  }, [workspace.routes, selectedRouteId]);

  useEffect(() => {
    if (!reviewStop) return;
    const existing = reviewByStop.get(reviewStop.id);
    setCheckedItems(Object.fromEntries(existing?.checklist_snapshot?.items?.map((item) => [item.id, item.checked]) || []));
    setReviewType(existing?.review_type || 'quick');
    setReviewResult(existing?.result || 'correct');
    setReviewAction(existing?.state === 'returned_for_rework' ? 'returned_for_rework' : 'reviewed');
    setReviewNotes(existing?.notes || '');
    setReworkReason(existing?.rework_reason || '');
    setCapacity(Number(existing?.inventory_snapshot?.capacity || 4));
    setManualTableware(existing?.inventory_snapshot?.manualExpectedTableware?.toString() || '');
  }, [reviewStop, reviewByStop]);

  const createNewRoute = async () => {
    try {
      const route = await workspace.createRoute({ name: routeName || `Ruta ${date}` });
      setSelectedRouteId(route.id);
      setRouteName('');
      toast({ title: 'Ruta creada', description: 'Ya puedes añadir apartamentos y trasteros.' });
    } catch (error) {
      toast({ title: 'No se pudo crear la ruta', description: error instanceof Error ? error.message : 'Error desconocido', variant: 'destructive' });
    }
  };

  const addTaskToRoute = async (task: Task) => {
    if (!selectedRoute) {
      toast({ title: 'Crea o selecciona una ruta primero', variant: 'destructive' });
      return;
    }
    if (selectedRoute.status === 'completed') {
      toast({ title: 'Ruta cerrada', description: 'No se pueden añadir paradas a una ruta cerrada.', variant: 'destructive' });
      return;
    }
    const stop = await workspace.addStop({
      route_id: selectedRoute.id,
      sequence: routeStops.length + 1,
      stop_type: 'apartment',
      property_id: task.propertyId || null,
      property_group_id: null,
      task_id: task.id,
      label: task.propertyName || task.property,
      status: 'pending',
    });
    await workspace.saveReservation({
      route_stop_id: stop.id,
      task_id: task.id,
      source: 'task',
      check_in: task.checkIn || null,
      check_out: task.checkOut || null,
      guests: null,
    });
    toast({ title: 'Apartamento añadido', description: task.propertyName || task.property });
  };

  const addStorageToRoute = async () => {
    if (!selectedRoute || selectedRoute.status === 'completed' || !storageLabel.trim()) return;
    await workspace.addStop({
      route_id: selectedRoute.id,
      sequence: routeStops.length + 1,
      stop_type: 'storage',
      property_id: null,
      property_group_id: null,
      task_id: null,
      label: storageLabel.trim(),
      status: 'pending',
    });
    setStorageLabel('');
    toast({ title: 'Trastero añadido' });
  };

  const moveStop = async (stop: SupervisionStop, direction: 'up' | 'down') => {
    try {
      await workspace.moveStop({ stop, direction, knownStops: routeStops });
      toast({ title: direction === 'up' ? 'Parada subida' : 'Parada bajada', description: 'El orden se ha guardado y se sincronizará si estás sin conexión.' });
    } catch (error) {
      toast({ title: 'No se pudo reordenar la parada', description: error instanceof Error ? error.message : 'Error desconocido', variant: 'destructive' });
    }
  };

  const submitReview = async () => {
    if (!selectedRoute || !reviewStop || selectedRoute.status === 'completed') return;
    const state = reviewAction === 'returned_for_rework' ? 'returned_for_rework' : reviewResult === 'incorrect' ? 'with_incidents' : 'reviewed';
    const snapshot = buildChecklistSnapshot(reviewStop.stop_type, checkedItems);
    const savedReview = await workspace.saveReview({
      route_id: selectedRoute.id,
      route_stop_id: reviewStop.id,
      task_id: reviewStop.task_id || null,
      property_id: reviewStop.property_id || null,
      property_group_id: reviewStop.property_group_id || null,
      reviewer_user_id: workspace.user?.id || null,
      review_type: reviewType,
      state,
      result: reviewResult,
      notes: reviewNotes || null,
      rework_reason: reviewAction === 'returned_for_rework' ? reworkReason || 'Repaso solicitado por supervisión' : null,
      checklist_snapshot: snapshot,
      inventory_snapshot: {
        capacity,
        expectedTableware: calculateExpectedTableware(capacity, manualTableware ? Number(manualTableware) : null),
        manualExpectedTableware: manualTableware ? Number(manualTableware) : null,
        results: {},
      },
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });
    let failedUploads = 0;
    for (const file of reviewFiles) {
      try {
        await workspace.uploadPhoto({ reviewId: savedReview.id, file });
      } catch {
        failedUploads += 1;
      }
    }
    setReviewFiles([]);
    setReviewStopId(null);
    toast({ title: state === 'returned_for_rework' ? 'Parada devuelta para repaso' : 'Revisión guardada', description: failedUploads ? `La revisión se guardó, pero ${failedUploads} foto(s) no se pudieron subir. Repite la carga cuando haya conexión.` : 'El historial conserva el resultado y la hora.' });
  };

  const submitIncident = async () => {
    if (!selectedRoute || !incidentStop || selectedRoute.status === 'completed' || !incidentDescription.trim()) return;
    await workspace.createIncident({
      sede_id: workspace.sedeId,
      route_id: selectedRoute.id,
      route_stop_id: incidentStop.id,
      review_id: latestReview?.id || null,
      task_id: incidentStop.task_id || null,
      property_id: incidentStop.property_id || null,
      property_group_id: incidentStop.property_group_id || null,
      category: incidentCategory,
      priority: incidentPriority,
      status: 'open',
      description: incidentDescription.trim(),
      responsible_user_id: null,
      target_date: incidentTargetDate || null,
      repeat_key: `${incidentCategory.toLowerCase()}::${incidentDescription.trim().toLowerCase().slice(0, 80)}`,
      created_by: workspace.user?.id || null,
    });
    setIncidentDescription('');
    setIncidentTargetDate('');
    setIncidentStopId(null);
    toast({ title: 'Incidencia registrada', description: incidentPriority === 'high' || incidentPriority === 'critical' ? 'Se ha intentado enviar el aviso inmediato.' : 'Aparece en el resumen de la ruta.' });
  };

  const exportRoutePdf = () => {
    if (!selectedRoute) return;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    let y = 18;
    const write = (text: string, size = 10, bold = false) => {
      pdf.setFont('helvetica', bold ? 'bold' : 'normal');
      pdf.setFontSize(size);
      const lines = pdf.splitTextToSize(text, 176);
      pdf.text(lines, 17, y);
      y += lines.length * (size > 14 ? 8 : 5) + 2;
      if (y > 276) { pdf.addPage(); y = 18; }
    };
    write('LIMPATEX · INFORME DE SUPERVISIÓN', 16, true);
    write(`${selectedRoute.name} · ${displayDate(date)}`, 11, true);
    write(`Sede: ${workspace.activeSede?.nombre || 'Sede activa'} · Estado: ${selectedRoute.status}`);
    write(`Paradas: ${routeStops.length} · Revisadas: ${routeStops.filter((stop) => reviewByStop.has(stop.id)).length} · Incidencias abiertas: ${workspace.pendingIncidents.filter((incident) => incident.route_id === selectedRoute.id).length}`);
    y += 3;
    routeStops.forEach((stop, index) => {
      const review = reviewByStop.get(stop.id);
      const incident = incidentByStop.get(stop.id);
      write(`${index + 1}. ${stopLabel(stop)} · ${stop.stop_type === 'storage' ? 'Trastero' : 'Apartamento'}`, 10, true);
      if (stop.task) write(`Limpieza: ${formatTime(stop.task.startTime)}–${formatTime(stop.task.endTime)} · ${stop.task.cleaner || 'Sin asignar'}`);
      write(`Reserva: ${getEntryMessage(stop.task, date)}`);
      write(`Resultado: ${getReviewStatusLabel(review)}${incident ? ` · Incidencia ${INCIDENT_PRIORITY_LABELS[incident.priority]}` : ''}`);
    });
    write(`Generado: ${new Date().toLocaleString('es-ES')}`);
    pdf.save(`supervision-${date}-${selectedRoute.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`);
  };

  if (!workspace.sedeId) return <div className="p-6"><Alert><AlertTitle>Sin sede activa</AlertTitle><AlertDescription>Selecciona una sede para iniciar la supervisión.</AlertDescription></Alert></div>;
  if (workspace.isLoading) return <div className="flex min-h-[60vh] items-center justify-center gap-3"><Loader2 className="animate-spin" /> Cargando agenda de supervisión…</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="flex flex-col gap-4 rounded-2xl bg-[#310984] p-5 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">Control operativo</p><h1 className="text-2xl font-bold">Supervisión y calidad</h1><p className="mt-1 text-sm text-violet-100">{workspace.activeSede?.nombre} · {displayDate(date)}</p></div>
          <div className="flex flex-wrap gap-2"><Input aria-label="Fecha de supervisión" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-[155px] bg-white text-slate-900" /><Button variant="secondary" onClick={() => void workspace.refresh()}><RefreshCw className="mr-2 h-4 w-4" />Actualizar</Button></div>
        </header>

        {workspace.warning && <Alert className="border-amber-300 bg-amber-50"><AlertTriangle className="h-4 w-4" /><AlertTitle>Modo de contingencia</AlertTitle><AlertDescription>{workspace.warning}</AlertDescription></Alert>}
        <div className="flex items-center gap-2 text-xs text-slate-500">{workspace.storageMode === 'remote' ? <Cloud className="h-4 w-4 text-emerald-600" /> : <CloudOff className="h-4 w-4 text-amber-600" />} {workspace.storageMode === 'remote' ? 'Datos sincronizados con servidor' : 'Cambios guardados localmente y pendientes de sincronización'}</div>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Cobertura de revisión</p><p className="mt-1 text-2xl font-bold text-[#310984]">{metrics.reviewCoverage}%</p><p className="text-xs text-slate-500">{metrics.reviewedStops}/{metrics.totalStops} paradas</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Revisión completa</p><p className="mt-1 text-2xl font-bold text-[#310984]">{metrics.fullReviewCoverage}%</p><p className="text-xs text-slate-500">{metrics.fullReviews} completas</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Incidencias abiertas</p><p className="mt-1 text-2xl font-bold text-red-700">{metrics.openIncidents}</p><p className="text-xs text-slate-500">{metrics.highPriorityIncidents} de alta prioridad</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Devoluciones</p><p className="mt-1 text-2xl font-bold text-amber-700">{metrics.returnedForRework}</p><p className="text-xs text-slate-500">pendientes de repaso</p></CardContent></Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <Card className="h-fit"><CardHeader><CardTitle className="flex items-center justify-between text-base">Rutas del día <Badge variant="secondary">{workspace.routes.length}</Badge></CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex gap-2"><Input placeholder="Nombre de ruta" value={routeName} onChange={(event) => setRouteName(event.target.value)} /><Button size="icon" onClick={() => void createNewRoute()} title="Crear ruta"><Plus className="h-4 w-4" /></Button></div>{workspace.routes.map((route) => <button key={route.id} type="button" onClick={() => setSelectedRouteId(route.id)} className={`w-full rounded-xl border p-3 text-left transition ${selectedRoute?.id === route.id ? 'border-[#310984] bg-violet-50' : 'border-slate-200 bg-white hover:border-violet-300'}`}><div className="flex items-center justify-between"><span className="font-semibold">{route.name}</span><Badge variant={route.status === 'completed' ? 'default' : 'outline'}>{route.status === 'completed' ? 'Cerrada' : route.status === 'in_progress' ? 'En curso' : 'Planificada'}</Badge></div><p className="mt-1 text-xs text-slate-500">{workspace.stops.filter((stop) => stop.route_id === route.id).length} paradas</p></button>)}{!workspace.routes.length && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Crea una ruta para empezar.</p>}</CardContent></Card>

          <div className="space-y-4">
            {selectedRoute ? <>
              <Card><CardHeader className="flex flex-row items-center justify-between space-y-0"><div><CardTitle className="text-lg">{selectedRoute.name}</CardTitle><p className="text-sm text-slate-500">Añade y ordena paradas manualmente sobre la marcha.</p></div><div className="flex gap-2"><Button variant="outline" onClick={exportRoutePdf}><Download className="mr-2 h-4 w-4" />PDF</Button>{selectedRoute.status !== 'completed' && <Button onClick={() => void workspace.completeRoute(selectedRoute)}><Check className="mr-2 h-4 w-4" />Cerrar ruta</Button>}</div></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-dashed border-violet-300 bg-violet-50 p-4"><div className="mb-2 flex items-center gap-2 font-semibold"><Warehouse className="h-4 w-4 text-[#310984]" />Añadir trastero</div><div className="flex gap-2"><Input placeholder="Ej. Trastero Coruña centro" value={storageLabel} onChange={(event) => setStorageLabel(event.target.value)} /><Button onClick={() => void addStorageToRoute()} disabled={!storageLabel.trim() || selectedRoute.status === 'completed'}><Plus className="mr-2 h-4 w-4" />Añadir</Button></div></div><div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4"><div className="flex items-center gap-2 font-semibold"><GripVertical className="h-4 w-4 text-slate-500" />Orden manual</div><p className="mt-1 text-sm text-slate-500">Añade paradas y usa las flechas de cada fila para ajustar el orden de visita, también sin conexión.</p></div></div></CardContent></Card>

              <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-5 w-5 text-[#310984]" />Ruta actual <Badge variant="secondary">{routeStops.length} paradas</Badge></CardTitle></CardHeader><CardContent className="space-y-3">{routeStops.length === 0 && <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Todavía no hay paradas. Añade candidatos de la agenda inferior o un trastero.</p>}{routeStops.map((stop, index) => { const review = reviewByStop.get(stop.id); const incident = incidentByStop.get(stop.id); return <div key={stop.id} className="flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#310984] text-sm font-bold text-white">{index + 1}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{stopLabel(stop)}</span><Badge variant="outline">{stop.stop_type === 'storage' ? 'Trastero' : 'Apartamento'}</Badge><Badge variant={review?.state === 'returned_for_rework' ? 'destructive' : review ? 'default' : 'secondary'}>{getReviewStatusLabel(review)}</Badge>{incident && <Badge variant="destructive">Incidencia {INCIDENT_PRIORITY_LABELS[incident.priority]}</Badge>}</div>{stop.task && <p className="mt-1 text-sm text-slate-500">{formatTime(stop.task.startTime)}–{formatTime(stop.task.endTime)} · {stop.task.cleaner || 'Sin trabajador'} · {getEntryMessage(stop.task, date)}</p>}{stop.stop_type === 'storage' && <p className="mt-1 text-sm text-slate-500">Control de organización, productos, material y repuestos.</p>}</div><div className="flex shrink-0 flex-wrap gap-2"><div className="flex rounded-md border bg-slate-50"><Button size="icon" variant="ghost" className="h-9 w-9" aria-label={`Subir ${stopLabel(stop)}`} title="Subir parada" disabled={index === 0 || selectedRoute.status === 'completed' || workspace.isSaving} onClick={() => void moveStop(stop, 'up')}><ChevronUp className="h-4 w-4" /></Button><Button size="icon" variant="ghost" className="h-9 w-9" aria-label={`Bajar ${stopLabel(stop)}`} title="Bajar parada" disabled={index === routeStops.length - 1 || selectedRoute.status === 'completed' || workspace.isSaving} onClick={() => void moveStop(stop, 'down')}><ChevronDown className="h-4 w-4" /></Button></div><Button size="sm" disabled={selectedRoute.status === 'completed'} onClick={() => setReviewStopId(stop.id)}><ClipboardCheck className="mr-2 h-4 w-4" />Revisar</Button><Button size="sm" variant="outline" disabled={selectedRoute.status === 'completed'} onClick={() => setIncidentStopId(stop.id)}><AlertTriangle className="mr-2 h-4 w-4" />Incidencia</Button></div></div>; })}</CardContent></Card>

              <Card><CardHeader><CardTitle className="text-base">Candidatos priorizados</CardTitle><p className="text-sm text-slate-500">Propuesta asistida; la supervisora decide qué entra en la ruta.</p></CardHeader><CardContent className="space-y-2">{candidates.length === 0 && <p className="text-sm text-slate-500">No hay limpiezas disponibles para esta fecha.</p>}{candidates.slice(0, 12).map(({ task, score, reasons }) => <div key={task.id} className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{task.propertyName || task.property}</span><Badge variant="secondary">Prioridad {Math.round(score)}</Badge></div><p className="text-xs text-slate-500">{task.cleaner || 'Sin trabajador'} · {getEntryMessage(task, date)}</p><p className="mt-1 text-xs text-violet-700">{reasons.join(' · ')}</p></div><Button size="sm" variant="outline" disabled={selectedRoute.status === 'completed'} onClick={() => void addTaskToRoute(task)}><Plus className="mr-2 h-4 w-4" />Añadir</Button></div>)}</CardContent></Card>
            </> : <Card><CardContent className="p-10 text-center text-slate-500">Crea una ruta para empezar la supervisión.</CardContent></Card>}
          </div>
        </section>

        <Card><CardHeader><CardTitle className="flex items-center justify-between text-base">Resumen de incidencias <Badge variant="destructive">{workspace.pendingIncidents.length}</Badge></CardTitle></CardHeader><CardContent className="space-y-2">{workspace.pendingIncidents.length === 0 && <p className="text-sm text-slate-500">No hay incidencias abiertas en la fecha seleccionada.</p>}{workspace.pendingIncidents.map((incident) => <div key={incident.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-medium">{incident.category} · {incident.description}</p><p className="text-xs text-slate-500">{incident.priority === 'critical' ? 'Crítica' : INCIDENT_PRIORITY_LABELS[incident.priority]} · {incident.target_date ? `Prevista ${incident.target_date}` : 'Sin fecha prevista'}</p></div><Button size="sm" variant="outline" onClick={() => void workspace.updateIncident({ incident, status: incident.status === 'open' ? 'in_progress' : 'resolved' })}>{incident.status === 'open' ? 'En curso' : 'Cerrar'}</Button></div>)}</CardContent></Card>
      </div>

      {reviewStop && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4"><div className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl"><div className="mb-4 flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-widest text-violet-700">Revisión de calidad</p><h2 className="text-xl font-bold">{stopLabel(reviewStop)}</h2></div><Button variant="ghost" size="icon" onClick={() => setReviewStopId(null)}><X /></Button></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Tipo<select className="mt-1 w-full rounded-md border p-2" value={reviewType} onChange={(event) => setReviewType(event.target.value as SupervisionReviewType)}><option value="quick">Rápida</option><option value="full">Completa</option></select></label><label className="text-sm font-medium">Resultado<select className="mt-1 w-full rounded-md border p-2" value={reviewResult} onChange={(event) => setReviewResult(event.target.value as 'correct' | 'incorrect')}><option value="correct">Correcto</option><option value="incorrect">Incorrecto</option></select></label></div><div className="mt-4 space-y-2"><p className="text-sm font-semibold">Checklist {reviewType === 'quick' ? '(mínimo operativo)' : '(completa)'}</p>{buildChecklistSnapshot(reviewStop.stop_type).items.map((item) => <label key={item.id} className="flex items-center gap-3 rounded-lg border p-3 text-sm"><Checkbox checked={checkedItems[item.id] || false} onCheckedChange={(checked) => setCheckedItems((current) => ({ ...current, [item.id]: checked === true }))} /><span><span className="font-medium">{item.label}</span><span className="block text-xs text-slate-500">{item.category}</span></span></label>)}</div>{reviewStop.stop_type === 'apartment' && <div className="mt-4 rounded-xl bg-slate-50 p-4"><p className="text-sm font-semibold">Inventario orientativo</p><div className="mt-2 grid gap-3 sm:grid-cols-2"><label className="text-sm">Capacidad según camas<Input type="number" min={0} value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} /></label><label className="text-sm">Menaje esperado (capacidad + 2)<Input type="number" min={0} placeholder={String(calculateExpectedTableware(capacity))} value={manualTableware} onChange={(event) => setManualTableware(event.target.value)} /></label></div><p className="mt-2 text-xs text-slate-500">Puedes sustituir el cálculo automático cuando la configuración real del apartamento lo requiera.</p></div>}<label className="mt-4 block text-sm font-medium">Notas<Textarea className="mt-1" value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} placeholder="Observaciones de la revisión…" /></label><label className="mt-4 block text-sm font-medium">Fotos opcionales<Input className="mt-1" type="file" accept="image/*" multiple onChange={(event) => setReviewFiles(Array.from(event.target.files || []))} /><span className="mt-1 block text-xs text-slate-500">Se comprimen antes de subirlas y quedan asociadas a esta revisión.</span></label><div className="mt-4 rounded-xl border p-4"><label className="flex items-center gap-2 text-sm font-medium"><input type="radio" checked={reviewAction === 'reviewed'} onChange={() => setReviewAction('reviewed')} /> Dejar revisado</label><label className="mt-2 flex items-center gap-2 text-sm font-medium"><input type="radio" checked={reviewAction === 'returned_for_rework'} onChange={() => setReviewAction('returned_for_rework')} /> Devolver para repaso</label>{reviewAction === 'returned_for_rework' && <Textarea className="mt-3" value={reworkReason} onChange={(event) => setReworkReason(event.target.value)} placeholder="Motivo y trabajo que debe repetirse…" />}</div><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setReviewStopId(null)}>Cancelar</Button><Button onClick={() => void submitReview()} disabled={workspace.isSaving}><Check className="mr-2 h-4 w-4" />Guardar revisión</Button></div></div></div>}

      {incidentStop && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4"><div className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl"><div className="mb-4 flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-widest text-red-700">Nueva incidencia</p><h2 className="text-xl font-bold">{stopLabel(incidentStop)}</h2></div><Button variant="ghost" size="icon" onClick={() => setIncidentStopId(null)}><X /></Button></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Categoría<Select value={incidentCategory} onValueChange={setIncidentCategory}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{INCIDENT_CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></label><label className="text-sm font-medium">Prioridad<Select value={incidentPriority} onValueChange={(value) => setIncidentPriority(value as SupervisionIncidentPriority)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(INCIDENT_PRIORITY_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></label></div><label className="mt-4 block text-sm font-medium">Descripción<Textarea className="mt-1" value={incidentDescription} onChange={(event) => setIncidentDescription(event.target.value)} placeholder="Qué ocurre, dónde y qué necesita el equipo…" /></label><label className="mt-4 block text-sm font-medium">Fecha prevista opcional<Input className="mt-1" type="date" value={incidentTargetDate} onChange={(event) => setIncidentTargetDate(event.target.value)} /></label><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setIncidentStopId(null)}>Cancelar</Button><Button variant="destructive" onClick={() => void submitIncident()} disabled={!incidentDescription.trim() || workspace.isSaving}><Send className="mr-2 h-4 w-4" />Registrar incidencia</Button></div></div></div>}
    </div>
  );
}
