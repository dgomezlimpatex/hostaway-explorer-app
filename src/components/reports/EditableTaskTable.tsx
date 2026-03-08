import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Save, Undo2, ChevronDown, ChevronUp } from 'lucide-react';
import { EditableTask } from '@/hooks/reports/useEditableReportData';
import { Task } from '@/types/calendar';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface EditableCellProps {
  value: string;
  onChange: (val: string) => void;
  isDirty: boolean;
  type?: 'text' | 'number' | 'time';
  label?: string;
}

const EditableCell = ({ value, onChange, isDirty, type = 'text', label }: EditableCellProps) => {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocalValue(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = () => {
    setEditing(false);
    if (localValue !== value) onChange(localValue);
  };

  if (editing) {
    return (
      <div className={label ? 'space-y-1' : ''}>
        {label && <span className="text-xs text-muted-foreground font-medium">{label}</span>}
        <Input
          ref={inputRef}
          type={type}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Tab') commit();
            if (e.key === 'Escape') { setLocalValue(value); setEditing(false); }
          }}
          className="h-8 text-sm px-2 min-w-[60px]"
        />
      </div>
    );
  }

  return (
    <div className={label ? 'space-y-1' : ''}>
      {label && <span className="text-xs text-muted-foreground font-medium">{label}</span>}
      <div
        onClick={() => setEditing(true)}
        className={cn(
          'cursor-pointer px-1 py-0.5 rounded min-h-[28px] text-xs flex items-center',
          isDirty
            ? 'bg-amber-100 dark:bg-amber-900/30 ring-1 ring-amber-400'
            : 'hover:bg-muted/60'
        )}
      >
        {value || <span className="text-muted-foreground italic">—</span>}
      </div>
    </div>
  );
};

interface SelectCellProps {
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
  isDirty: boolean;
  label?: string;
}

const SelectCell = ({ value, options, onChange, isDirty, label }: SelectCellProps) => (
  <div className={cn(label ? 'space-y-1' : '')}>
    {label && <span className="text-xs text-muted-foreground font-medium">{label}</span>}
    <div className={cn(
      'rounded',
      isDirty && 'bg-amber-100 dark:bg-amber-900/30 ring-1 ring-amber-400'
    )}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs min-w-[100px] border-0 bg-transparent shadow-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  </div>
);

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'in-progress', label: 'En Progreso' },
  { value: 'completed', label: 'Completada' },
];

const TYPE_OPTIONS = [
  { value: 'check-in', label: 'Check-in' },
  { value: 'check-out', label: 'Check-out' },
  { value: 'check-in-out', label: 'Check-in/out' },
  { value: 'courtesy', label: 'Cortesía' },
  { value: 'deep-cleaning', label: 'Limpieza profunda' },
  { value: 'laundry-only', label: 'Solo lavandería' },
  { value: 'extraordinary', label: 'Extraordinario' },
];

const PAYMENT_OPTIONS = [
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'factura', label: 'Factura' },
];

const statusLabel = (s: string) => STATUS_OPTIONS.find(o => o.value === s)?.label || s;
const typeLabel = (t: string) => TYPE_OPTIONS.find(o => o.value === t)?.label || t;

interface EditableTaskTableProps {
  tasks: EditableTask[];
  isLoading: boolean;
  updateField: (taskId: string, field: keyof Task, value: any) => void;
  isFieldDirty: (taskId: string, field: string) => boolean;
  pendingCount: number;
  isSaving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

/* ─── Mobile Card for a single task ─── */
const MobileTaskCard = ({
  task, updateField, isFieldDirty
}: {
  task: EditableTask;
  updateField: (taskId: string, field: keyof Task, value: any) => void;
  isFieldDirty: (taskId: string, field: string) => boolean;
}) => {
  const [expanded, setExpanded] = useState(false);

  const hasDirtyFields = ['date','property','address','startTime','endTime','type','status','cleaner','client','supervisor','cost','paymentMethod','notes']
    .some(f => isFieldDirty(task.id, f));

  return (
    <div className={cn(
      'border rounded-lg p-3 space-y-2 transition-colors',
      hasDirtyFields ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-900/10' : 'bg-card'
    )}>
      {/* Summary row - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold truncate">{task.property || '—'}</span>
            <Badge variant="outline" className="text-[10px] shrink-0">
              {typeLabel(task.type)}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <span>{task.date}</span>
            <span>·</span>
            <span>{task.startTime}–{task.endTime}</span>
            <span>·</span>
            <span>{statusLabel(task.status)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {task.cost != null && (
            <span className="text-sm font-medium">{task.cost}€</span>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded editable fields */}
      {expanded && (
        <div className="pt-2 border-t space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <EditableCell label="Fecha" value={task.date} onChange={(v) => updateField(task.id, 'date', v)} isDirty={isFieldDirty(task.id, 'date')} />
            <EditableCell label="Propiedad" value={task.property} onChange={(v) => updateField(task.id, 'property', v)} isDirty={isFieldDirty(task.id, 'property')} />
          </div>
          <EditableCell label="Dirección" value={task.address} onChange={(v) => updateField(task.id, 'address', v)} isDirty={isFieldDirty(task.id, 'address')} />
          <div className="grid grid-cols-2 gap-3">
            <EditableCell label="Inicio" value={task.startTime} onChange={(v) => updateField(task.id, 'startTime', v)} isDirty={isFieldDirty(task.id, 'startTime')} type="time" />
            <EditableCell label="Fin" value={task.endTime} onChange={(v) => updateField(task.id, 'endTime', v)} isDirty={isFieldDirty(task.id, 'endTime')} type="time" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectCell label="Tipo" value={task.type} options={TYPE_OPTIONS} onChange={(v) => updateField(task.id, 'type', v)} isDirty={isFieldDirty(task.id, 'type')} />
            <SelectCell label="Estado" value={task.status} options={STATUS_OPTIONS} onChange={(v) => updateField(task.id, 'status', v as any)} isDirty={isFieldDirty(task.id, 'status')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <EditableCell label="Trabajador" value={task.cleaner || ''} onChange={(v) => updateField(task.id, 'cleaner', v)} isDirty={isFieldDirty(task.id, 'cleaner')} />
            <EditableCell label="Cliente" value={task.clientName || ''} onChange={(v) => updateField(task.id, 'client', v)} isDirty={isFieldDirty(task.id, 'client')} />
          </div>
          <EditableCell label="Supervisor" value={task.supervisor || ''} onChange={(v) => updateField(task.id, 'supervisor', v)} isDirty={isFieldDirty(task.id, 'supervisor')} />
          <div className="grid grid-cols-2 gap-3">
            <EditableCell label="Coste (€)" value={String(task.cost ?? '')} onChange={(v) => updateField(task.id, 'cost', v ? Number(v) : undefined)} isDirty={isFieldDirty(task.id, 'cost')} type="number" />
            <SelectCell label="Método Pago" value={task.paymentMethod || 'transferencia'} options={PAYMENT_OPTIONS} onChange={(v) => updateField(task.id, 'paymentMethod', v)} isDirty={isFieldDirty(task.id, 'paymentMethod')} />
          </div>
          <EditableCell label="Notas" value={task.notes || ''} onChange={(v) => updateField(task.id, 'notes', v)} isDirty={isFieldDirty(task.id, 'notes')} />
        </div>
      )}
    </div>
  );
};

export const EditableTaskTable = ({
  tasks,
  isLoading,
  updateField,
  isFieldDirty,
  pendingCount,
  isSaving,
  onSave,
  onDiscard,
}: EditableTaskTableProps) => {
  const isMobile = useIsMobile();

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-3 sm:px-6">
          <CardTitle className="text-base sm:text-lg">📋 Tareas Editables</CardTitle>
          {/* Desktop save controls */}
          {!isMobile && pendingCount > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                {pendingCount} cambio(s)
              </Badge>
              <Button size="sm" variant="outline" onClick={onDiscard} disabled={isSaving}>
                <Undo2 className="h-3.5 w-3.5 mr-1" />
                Descartar
              </Button>
              <Button size="sm" onClick={onSave} disabled={isSaving}>
                <Save className="h-3.5 w-3.5 mr-1" />
                {isSaving ? 'Guardando...' : 'Guardar todo'}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className={cn(isMobile ? 'p-2' : 'p-0')}>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando tareas...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No hay tareas para el período seleccionado</div>
          ) : isMobile ? (
            /* ─── Mobile: Card list ─── */
            <div className="space-y-2">
              {tasks.map((task) => (
                <MobileTaskCard
                  key={task.id}
                  task={task}
                  updateField={updateField}
                  isFieldDirty={isFieldDirty}
                />
              ))}
            </div>
          ) : (
            /* ─── Desktop: Table ─── */
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs font-semibold min-w-[90px] sticky left-0 bg-muted/40 z-10">Fecha</TableHead>
                    <TableHead className="text-xs font-semibold min-w-[120px]">Propiedad</TableHead>
                    <TableHead className="text-xs font-semibold min-w-[150px]">Dirección</TableHead>
                    <TableHead className="text-xs font-semibold min-w-[70px]">Inicio</TableHead>
                    <TableHead className="text-xs font-semibold min-w-[70px]">Fin</TableHead>
                    <TableHead className="text-xs font-semibold min-w-[130px]">Tipo</TableHead>
                    <TableHead className="text-xs font-semibold min-w-[120px]">Estado</TableHead>
                    <TableHead className="text-xs font-semibold min-w-[120px]">Trabajador</TableHead>
                    <TableHead className="text-xs font-semibold min-w-[120px]">Cliente</TableHead>
                    <TableHead className="text-xs font-semibold min-w-[120px]">Supervisor</TableHead>
                    <TableHead className="text-xs font-semibold min-w-[80px]">Coste (€)</TableHead>
                    <TableHead className="text-xs font-semibold min-w-[120px]">Método Pago</TableHead>
                    <TableHead className="text-xs font-semibold min-w-[200px]">Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow key={task.id} className="hover:bg-muted/20">
                      <TableCell className="p-1 sticky left-0 bg-background z-10">
                        <EditableCell value={task.date} onChange={(v) => updateField(task.id, 'date', v)} isDirty={isFieldDirty(task.id, 'date')} />
                      </TableCell>
                      <TableCell className="p-1">
                        <EditableCell value={task.property} onChange={(v) => updateField(task.id, 'property', v)} isDirty={isFieldDirty(task.id, 'property')} />
                      </TableCell>
                      <TableCell className="p-1">
                        <EditableCell value={task.address} onChange={(v) => updateField(task.id, 'address', v)} isDirty={isFieldDirty(task.id, 'address')} />
                      </TableCell>
                      <TableCell className="p-1">
                        <EditableCell value={task.startTime} onChange={(v) => updateField(task.id, 'startTime', v)} isDirty={isFieldDirty(task.id, 'startTime')} type="time" />
                      </TableCell>
                      <TableCell className="p-1">
                        <EditableCell value={task.endTime} onChange={(v) => updateField(task.id, 'endTime', v)} isDirty={isFieldDirty(task.id, 'endTime')} type="time" />
                      </TableCell>
                      <TableCell className="p-1">
                        <SelectCell value={task.type} options={TYPE_OPTIONS} onChange={(v) => updateField(task.id, 'type', v)} isDirty={isFieldDirty(task.id, 'type')} />
                      </TableCell>
                      <TableCell className="p-1">
                        <SelectCell value={task.status} options={STATUS_OPTIONS} onChange={(v) => updateField(task.id, 'status', v as any)} isDirty={isFieldDirty(task.id, 'status')} />
                      </TableCell>
                      <TableCell className="p-1">
                        <EditableCell value={task.cleaner || ''} onChange={(v) => updateField(task.id, 'cleaner', v)} isDirty={isFieldDirty(task.id, 'cleaner')} />
                      </TableCell>
                      <TableCell className="p-1">
                        <EditableCell value={task.clientName || ''} onChange={(v) => updateField(task.id, 'client', v)} isDirty={isFieldDirty(task.id, 'client')} />
                      </TableCell>
                      <TableCell className="p-1">
                        <EditableCell value={task.supervisor || ''} onChange={(v) => updateField(task.id, 'supervisor', v)} isDirty={isFieldDirty(task.id, 'supervisor')} />
                      </TableCell>
                      <TableCell className="p-1">
                        <EditableCell value={String(task.cost ?? '')} onChange={(v) => updateField(task.id, 'cost', v ? Number(v) : undefined)} isDirty={isFieldDirty(task.id, 'cost')} type="number" />
                      </TableCell>
                      <TableCell className="p-1">
                        <SelectCell value={task.paymentMethod || 'transferencia'} options={PAYMENT_OPTIONS} onChange={(v) => updateField(task.id, 'paymentMethod', v)} isDirty={isFieldDirty(task.id, 'paymentMethod')} />
                      </TableCell>
                      <TableCell className="p-1">
                        <EditableCell value={task.notes || ''} onChange={(v) => updateField(task.id, 'notes', v)} isDirty={isFieldDirty(task.id, 'notes')} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Mobile: Floating save bar ─── */}
      {isMobile && pendingCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t shadow-lg p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex items-center gap-2">
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 shrink-0">
            {pendingCount}
          </Badge>
          <Button variant="outline" size="sm" className="flex-1" onClick={onDiscard} disabled={isSaving}>
            <Undo2 className="h-3.5 w-3.5 mr-1" />
            Descartar
          </Button>
          <Button size="sm" className="flex-1" onClick={onSave} disabled={isSaving}>
            <Save className="h-3.5 w-3.5 mr-1" />
            {isSaving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      )}
    </>
  );
};
