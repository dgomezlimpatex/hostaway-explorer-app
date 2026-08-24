import { Check, Loader2, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { SupervisionStockCheckLine } from '@/features/supervision/buildingSupervisionStorage';

interface StockCheckSheetProps {
  buildingName: string;
  warehouseName: string;
  lines: SupervisionStockCheckLine[];
  isSaving: boolean;
  onComplete: (lines: Array<{ id: string; observed_quantity: number; notes?: string | null }>, notes?: string | null) => Promise<unknown>;
  onClose: () => void;
}

export const StockCheckSheet = ({ buildingName, warehouseName, lines, isSaving, onComplete, onClose }: StockCheckSheetProps) => {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(lines.map((line) => [line.id, String(line.observed_quantity ?? line.expected_quantity)])));
  const [notes, setNotes] = useState('');
  const submit = async () => {
    await onComplete(lines.map((line) => ({ id: line.id, observed_quantity: Number(values[line.id] || 0) })), notes.trim() || null);
    onClose();
  };
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4"><div className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl"><div className="mb-4 flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Inventario de trastero</p><h2 className="text-xl font-bold text-slate-950">{buildingName}</h2><p className="mt-1 text-sm text-slate-500">{warehouseName} · comprueba las cantidades físicas actuales</p></div><Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar inventario"><X /></Button></div><div className="space-y-2">{lines.map((line) => <div key={line.id} className="grid grid-cols-[1fr_110px] items-center gap-3 rounded-xl border p-3"><div><p className="font-medium text-slate-950">{line.product?.name || 'Producto'}</p><p className="text-xs text-slate-500">Objetivo: {line.expected_quantity} {line.product?.unit_of_measure || 'unidades'}</p></div><Input aria-label={`Cantidad observada de ${line.product?.name || 'producto'}`} type="number" min={0} step="0.01" value={values[line.id] || ''} onChange={(event) => setValues((current) => ({ ...current, [line.id]: event.target.value }))} /></div>)}</div><label className="mt-4 block text-sm font-medium">Notas del recuento<Textarea className="mt-1" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Diferencias, productos a reponer o incidencias del material…" /></label><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => void submit()} disabled={isSaving || lines.length === 0}>{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Cerrar inventario</Button></div></div></div>;
};
