import { useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { buildChecklistSnapshot, calculateExpectedTableware, INCIDENT_CATEGORIES, INCIDENT_PRIORITY_LABELS } from '@/features/supervision/domain';
import type { BuildingAgendaItem } from '@/features/supervision/buildingAgenda';
import type { SupervisionIncident, SupervisionReview, SupervisionRoute, SupervisionStop, SupervisionIncidentPriority, SupervisionReviewType } from '@/features/supervision/types';

interface ApartmentReviewSheetProps {
  item: BuildingAgendaItem;
  route: SupervisionRoute;
  stop: SupervisionStop;
  userId: string;
  isSaving: boolean;
  onSaveReview: (review: Omit<SupervisionReview, 'id' | 'created_at' | 'updated_at'>) => Promise<SupervisionReview>;
  onUploadPhoto: (input: { reviewId: string; file: File }) => Promise<string>;
  onCreateIncident: (incident: Omit<SupervisionIncident, 'id' | 'created_at' | 'updated_at'>) => Promise<SupervisionIncident>;
  onCompleteWorkItem?: (workItemId: string) => Promise<unknown>;
  onClose: () => void;
  onSaved: () => void;
}

export const ApartmentReviewSheet = ({
  item,
  route,
  stop,
  userId,
  isSaving,
  onSaveReview,
  onUploadPhoto,
  onCreateIncident,
  onClose,
  onSaved,
}: ApartmentReviewSheetProps) => {
  const [reviewType, setReviewType] = useState<SupervisionReviewType>(item.type === 'full' ? 'full' : 'quick');
  const [reviewResult, setReviewResult] = useState<'correct' | 'incorrect'>('correct');
  const [reviewAction, setReviewAction] = useState<'reviewed' | 'returned_for_rework'>('reviewed');
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');
  const [reworkReason, setReworkReason] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [capacity, setCapacity] = useState(4);
  const [manualTableware, setManualTableware] = useState('');
  const [createIncident, setCreateIncident] = useState(true);
  const [incidentPriority, setIncidentPriority] = useState<SupervisionIncidentPriority>('medium');
  const [incidentCategory, setIncidentCategory] = useState<string>(INCIDENT_CATEGORIES[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    setIsSubmitting(true);
    try {
      const state = reviewAction === 'returned_for_rework'
        ? 'returned_for_rework'
        : reviewResult === 'incorrect' ? 'with_incidents' : 'reviewed';
      const now = new Date().toISOString();
      const review = await onSaveReview({
        route_id: route.id,
        route_stop_id: stop.id,
        task_id: stop.task_id || null,
        property_id: stop.property_id || null,
        property_group_id: stop.property_group_id || null,
        reviewer_user_id: userId,
        review_type: reviewType,
        state,
        result: reviewResult,
        notes: notes.trim() || null,
        rework_reason: reviewAction === 'returned_for_rework' ? reworkReason.trim() || 'Repaso solicitado por supervisión' : null,
        checklist_snapshot: buildChecklistSnapshot('apartment', checkedItems),
        inventory_snapshot: {
          capacity,
          expectedTableware: calculateExpectedTableware(capacity, manualTableware ? Number(manualTableware) : null),
          manualExpectedTableware: manualTableware ? Number(manualTableware) : null,
          results: {},
        },
        started_at: now,
        completed_at: now,
      });

      for (const file of files) await onUploadPhoto({ reviewId: review.id, file });

      if (reviewResult === 'incorrect' && createIncident) {
        await onCreateIncident({
          sede_id: route.sede_id,
          route_id: route.id,
          route_stop_id: stop.id,
          review_id: review.id,
          task_id: stop.task_id || null,
          property_id: stop.property_id || null,
          property_group_id: stop.property_group_id || null,
          category: incidentCategory,
          priority: incidentPriority,
          status: 'open',
          description: notes.trim() || 'La revisión de calidad ha detectado una incidencia.',
          responsible_user_id: null,
          target_date: null,
          repeat_key: `${incidentCategory.toLowerCase()}::${item.propertyId}`,
          created_by: userId,
        });
      }
      if (item.workItemId && onCompleteWorkItem) await onCompleteWorkItem(item.workItemId);
      onSaved();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-700">Comprobación de apartamento</p>
            <h2 className="text-xl font-bold text-slate-950">{item.propertyCode ? `${item.propertyCode} · ` : ''}{item.propertyName}</h2>
            <p className="mt-1 text-sm text-slate-500">{item.reasons.join(' · ')}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar comprobación"><X /></Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">Tipo<select className="mt-1 w-full rounded-md border p-2" value={reviewType} onChange={(event) => setReviewType(event.target.value as SupervisionReviewType)}><option value="quick">Rápida</option><option value="full">Completa</option></select></label>
          <label className="text-sm font-medium">Resultado<Select value={reviewResult} onValueChange={(value) => setReviewResult(value as 'correct' | 'incorrect')}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="correct">Correcto</SelectItem><SelectItem value="incorrect">Incorrecto</SelectItem></SelectContent></Select></label>
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-sm font-semibold">Checklist {reviewType === 'quick' ? 'rápida' : 'completa'}</p>
          {buildChecklistSnapshot('apartment').items.map((checkItem) => (
            <label key={checkItem.id} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
              <Checkbox checked={checkedItems[checkItem.id] || false} onCheckedChange={(checked) => setCheckedItems((current) => ({ ...current, [checkItem.id]: checked === true }))} />
              <span><span className="font-medium">{checkItem.label}</span><span className="block text-xs text-slate-500">{checkItem.category}</span></span>
            </label>
          ))}
        </div>

        <div className="mt-4 rounded-xl bg-slate-50 p-4">
          <p className="text-sm font-semibold">Comprobación de menaje</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Capacidad<Input type="number" min={0} value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} /></label>
            <label className="text-sm">Menaje esperado<Input type="number" min={0} placeholder={String(calculateExpectedTableware(capacity))} value={manualTableware} onChange={(event) => setManualTableware(event.target.value)} /></label>
          </div>
        </div>

        <label className="mt-4 block text-sm font-medium">Notas<Textarea className="mt-1" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Qué has comprobado y qué necesita atención…" /></label>
        <label className="mt-4 block text-sm font-medium">Fotos opcionales<Input className="mt-1" type="file" accept="image/*" multiple onChange={(event) => setFiles(Array.from(event.target.files || []))} /><span className="mt-1 block text-xs text-slate-500">Se comprimen y quedan asociadas a esta comprobación.</span></label>

        {reviewResult === 'incorrect' && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
            <label className="flex items-center gap-2 text-sm font-medium"><Checkbox checked={createIncident} onCheckedChange={(checked) => setCreateIncident(checked === true)} />Crear incidencia automáticamente</label>
            {createIncident && <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm">Categoría<Select value={incidentCategory} onValueChange={setIncidentCategory}><SelectTrigger className="mt-1 bg-white"><SelectValue /></SelectTrigger><SelectContent>{INCIDENT_CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></label><label className="text-sm">Prioridad<Select value={incidentPriority} onValueChange={(value) => setIncidentPriority(value as SupervisionIncidentPriority)}><SelectTrigger className="mt-1 bg-white"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(INCIDENT_PRIORITY_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></label></div>}
          </div>
        )}

        <div className="mt-4 rounded-xl border p-4">
          <label className="flex items-center gap-2 text-sm font-medium"><input type="radio" checked={reviewAction === 'reviewed'} onChange={() => setReviewAction('reviewed')} /> Dejar revisado</label>
          <label className="mt-2 flex items-center gap-2 text-sm font-medium"><input type="radio" checked={reviewAction === 'returned_for_rework'} onChange={() => setReviewAction('returned_for_rework')} /> Devolver para repaso</label>
          {reviewAction === 'returned_for_rework' && <Textarea className="mt-3" value={reworkReason} onChange={(event) => setReworkReason(event.target.value)} placeholder="Qué debe repetirse…" />}
        </div>

        <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => void submit()} disabled={isSaving || isSubmitting}>{isSaving || isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Guardar comprobación</Button></div>
      </div>
    </div>
  );
};
