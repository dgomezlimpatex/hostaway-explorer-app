import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Save, Undo2 } from 'lucide-react';
import { EditableTask } from '@/hooks/reports/useEditableReportData';
import { Task } from '@/types/calendar';
import { cn } from '@/lib/utils';

interface EditableCellProps {
  value: string;
  onChange: (val: string) => void;
  isDirty: boolean;
  type?: 'text' | 'number' | 'time';
}

const EditableCell = ({ value, onChange, isDirty, type = 'text' }: EditableCellProps) => {
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
        className="h-7 text-xs px-1 min-w-[60px]"
      />
    );
  }

  return (
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
  );
};

interface SelectCellProps {
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
  isDirty: boolean;
}

const SelectCell = ({ value, options, onChange, isDirty }: SelectCellProps) => (
  <div className={cn(
    'rounded',
    isDirty && 'bg-amber-100 dark:bg-amber-900/30 ring-1 ring-amber-400'
  )}>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-7 text-xs min-w-[100px] border-0 bg-transparent shadow-none">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
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
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-lg">📋 Hoja de Tareas Editable</CardTitle>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <>
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                {pendingCount} cambio(s) sin guardar
              </Badge>
              <Button size="sm" variant="outline" onClick={onDiscard} disabled={isSaving}>
                <Undo2 className="h-3.5 w-3.5 mr-1" />
                Descartar
              </Button>
              <Button size="sm" onClick={onSave} disabled={isSaving}>
                <Save className="h-3.5 w-3.5 mr-1" />
                {isSaving ? 'Guardando...' : 'Guardar todo'}
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
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
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                    Cargando tareas...
                  </TableCell>
                </TableRow>
              ) : tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                    No hay tareas para el período seleccionado
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((task) => (
                  <TableRow key={task.id} className="hover:bg-muted/20">
                    <TableCell className="p-1 sticky left-0 bg-background z-10">
                      <EditableCell
                        value={task.date}
                        onChange={(v) => updateField(task.id, 'date', v)}
                        isDirty={isFieldDirty(task.id, 'date')}
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <EditableCell
                        value={task.property}
                        onChange={(v) => updateField(task.id, 'property', v)}
                        isDirty={isFieldDirty(task.id, 'property')}
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <EditableCell
                        value={task.address}
                        onChange={(v) => updateField(task.id, 'address', v)}
                        isDirty={isFieldDirty(task.id, 'address')}
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <EditableCell
                        value={task.startTime}
                        onChange={(v) => updateField(task.id, 'startTime', v)}
                        isDirty={isFieldDirty(task.id, 'startTime')}
                        type="time"
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <EditableCell
                        value={task.endTime}
                        onChange={(v) => updateField(task.id, 'endTime', v)}
                        isDirty={isFieldDirty(task.id, 'endTime')}
                        type="time"
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <SelectCell
                        value={task.type}
                        options={TYPE_OPTIONS}
                        onChange={(v) => updateField(task.id, 'type', v)}
                        isDirty={isFieldDirty(task.id, 'type')}
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <SelectCell
                        value={task.status}
                        options={STATUS_OPTIONS}
                        onChange={(v) => updateField(task.id, 'status', v as any)}
                        isDirty={isFieldDirty(task.id, 'status')}
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <EditableCell
                        value={task.cleaner || ''}
                        onChange={(v) => updateField(task.id, 'cleaner', v)}
                        isDirty={isFieldDirty(task.id, 'cleaner')}
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <EditableCell
                        value={task.clientName || ''}
                        onChange={(v) => updateField(task.id, 'client', v)}
                        isDirty={isFieldDirty(task.id, 'client')}
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <EditableCell
                        value={task.supervisor || ''}
                        onChange={(v) => updateField(task.id, 'supervisor', v)}
                        isDirty={isFieldDirty(task.id, 'supervisor')}
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <EditableCell
                        value={String(task.cost ?? '')}
                        onChange={(v) => updateField(task.id, 'cost', v ? Number(v) : undefined)}
                        isDirty={isFieldDirty(task.id, 'cost')}
                        type="number"
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <SelectCell
                        value={task.paymentMethod || 'transferencia'}
                        options={PAYMENT_OPTIONS}
                        onChange={(v) => updateField(task.id, 'paymentMethod', v)}
                        isDirty={isFieldDirty(task.id, 'paymentMethod')}
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <EditableCell
                        value={task.notes || ''}
                        onChange={(v) => updateField(task.id, 'notes', v)}
                        isDirty={isFieldDirty(task.id, 'notes')}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
