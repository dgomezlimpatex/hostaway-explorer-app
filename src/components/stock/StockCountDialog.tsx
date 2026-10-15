import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ClipboardCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useSede } from '@/contexts/SedeContext';
import { stockStorage } from '@/services/storage/stockStorage';
import { formatMadridDate } from '@/utils/date';
import { cn } from '@/lib/utils';
import type { StockLevel } from '@/types/stock';
import { buildCountLines, countReason, linesToApply, summarizeCount } from './stockCount';

interface StockCountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  levels: StockLevel[];
}

const formatQuantity = (value: number) =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2, signDisplay: 'exceptZero' }).format(value);
const formatPlain = (value: number) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(value);
const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);

export function StockCountDialog({ open, onOpenChange, levels }: StockCountDialogProps) {
  const { user } = useAuth();
  const { activeSede } = useSede();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');

  const sortedLevels = useMemo(
    () => [...levels].sort((a, b) =>
      `${a.warehouse?.name || ''}|${a.product?.category?.name || ''}|${a.product?.name || ''}`
        .localeCompare(`${b.warehouse?.name || ''}|${b.product?.category?.name || ''}|${b.product?.name || ''}`, 'es')
    ),
    [levels]
  );

  // Counted quantities survive closing the dialog or losing the page until they are saved or discarded.
  const draftKey = `inventory-count-draft:${user?.id ?? 'anonymous'}`;
  const persistDraft = useCallback((values: Record<string, string>, text: string) => {
    const filled = Object.fromEntries(Object.entries(values).filter(([, value]) => String(value).trim() !== ''));
    try {
      if (Object.keys(filled).length || text.trim()) localStorage.setItem(draftKey, JSON.stringify({ drafts: filled, note: text }));
      else localStorage.removeItem(draftKey);
    } catch { /* storage unavailable: the draft lives only while the dialog is open */ }
  }, [draftKey]);
  useEffect(() => {
    if (!open) return;
    let saved: { drafts?: unknown; note?: unknown } = {};
    try { saved = JSON.parse(localStorage.getItem(draftKey) || '{}'); } catch { saved = {}; }
    setDrafts(saved.drafts && typeof saved.drafts === 'object' ? saved.drafts as Record<string, string> : {});
    setNote(typeof saved.note === 'string' ? saved.note : '');
    setSearch('');
  }, [open, draftKey]);
  useEffect(() => { if (open) persistDraft(drafts, note); }, [open, drafts, note, persistDraft]);
  const discardDraft = () => { setDrafts({}); setNote(''); persistDraft({}, ''); };

  const lines = useMemo(() => buildCountLines(sortedLevels, drafts), [sortedLevels, drafts]);
  const summary = useMemo(() => summarizeCount(lines), [lines]);
  const toApply = useMemo(() => linesToApply(lines), [lines]);
  const normalizedSearch = search.trim().toLowerCase();
  const visibleLines = normalizedSearch
    ? lines.filter(({ level }) => [level.product?.name, level.warehouse?.name, level.product?.sku]
        .some((value) => value?.toLowerCase().includes(normalizedSearch)))
    : lines;

  const applyCount = useMutation({
    mutationFn: async () => {
      const reason = countReason(formatMadridDate(new Date()), note);
      const failed: Array<{ name: string; message: string }> = [];
      let applied = 0;
      const appliedIds: string[] = [];
      // Cada línea es un ajuste atómico propio: un fallo no deshace las demás y se informa al final.
      for (const line of toApply) {
        try {
          await stockStorage.adjustStock({
            stock_level: line.level,
            movement_type: 'ajuste',
            quantity: line.counted as number,
            reason,
            user_id: user!.id,
            verified_count: line.level.bag_accounting_active === true,
          });
          applied += 1;
          appliedIds.push(line.level.id);
        } catch (error) {
          failed.push({
            name: `${line.level.product?.name || 'Producto'} (${line.level.warehouse?.name || 'almacén'})`,
            message: error instanceof Error ? error.message : 'Error desconocido',
          });
        }
      }
      return { applied, failed, appliedIds };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-levels', activeSede?.id] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements', activeSede?.id] });
      queryClient.invalidateQueries({ queryKey: ['stock-alerts', activeSede?.id] });
    },
    onSuccess: ({ applied, failed, appliedIds }) => {
      const remaining = Object.fromEntries(Object.entries(drafts).filter(([id]) => !appliedIds.includes(id)));
      setDrafts(remaining);
      if (failed.length === 0) {
        setNote('');
        persistDraft(remaining, '');
        toast.success(`Recuento guardado: ${applied} ${applied === 1 ? 'línea' : 'líneas'}`);
        onOpenChange(false);
        return;
      }
      persistDraft(remaining, note);
      toast.error(`${failed.length} ${failed.length === 1 ? 'línea no se pudo' : 'líneas no se pudieron'} ajustar (${applied} aplicadas): ${failed.map((item) => `${item.name}: ${item.message}`).join('; ')}`, { duration: 15000 });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'No se pudo aplicar el recuento');
    },
  });

  const canApply = toApply.length > 0 && summary.invalid === 0 && !applyCount.isPending && !!user?.id;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!applyCount.isPending) onOpenChange(next); }}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-4xl overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5" />Contar existencias</DialogTitle>
          <DialogDescription>
            {levels.some(level=>level.bag_accounting_active) ? 'Cuenta solo el material suelto, sin incluir bolsas preparadas. Las líneas en blanco siguen pendientes. Una cantidad coincidente también queda acreditada como recuento. Las recepciones anteriores al recuento conservan su historial y no se suman de nuevo.' : 'Escribe lo que has contado. Las líneas en blanco no se tocan y solo se ajustan las que difieren del sistema; cada ajuste queda registrado como movimiento.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="count-search">Buscar línea</Label>
              <Input id="count-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Producto, almacén o SKU" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="count-note">Nota del recuento (opcional)</Label>
              <Input id="count-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ej. almacén central, turno de tarde" maxLength={120} />
            </div>
          </div>

          <p role="status" className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
            {summary.pending} sin contar · {summary.same} coinciden · <strong className="text-foreground">{summary.withDifference} con diferencia</strong>
            {summary.withDifference > 0 && <> ({formatQuantity(summary.unitsDifference)} unidades netas · {formatCurrency(summary.valueDifference)})</>}
            {summary.invalid > 0 && <span className="text-red-700"> · {summary.invalid} con valor no válido</span>}
          </p>
          {lines.some((line) => line.status !== 'pending') && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/15 bg-primary/[.04] px-3 py-2 text-xs">
              <span>Borrador sin guardar: se conserva en este dispositivo si cierras, hasta guardarlo o descartarlo.</span>
              <Button type="button" variant="ghost" size="sm" className="h-8 text-red-700 hover:text-red-800" disabled={applyCount.isPending} onClick={discardDraft}>Descartar recuento</Button>
            </div>
          )}

          <ul className="divide-y rounded-md border">
            {visibleLines.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">No hay líneas que coincidan.</li>
            )}
            {visibleLines.map(({ level, status, difference }) => (
              <li key={level.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 px-3 py-3 sm:grid-cols-[1fr_5rem_7rem_6rem]">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{level.product?.name || 'Producto'}</p>
                  <p className="truncate text-xs text-muted-foreground">{level.warehouse?.name || 'Almacén'} · {level.product?.category?.name || 'Sin tipo'} · {level.product?.unit_of_measure || 'unidades'}</p>
                </div>
                <p className="text-right font-mono text-sm sm:order-none"><span className="mr-1 text-[10px] font-sans text-muted-foreground sm:hidden">Sistema</span>{formatPlain(level.current_quantity)}</p>
                <Input
                  aria-label={`Contado: ${level.product?.name || 'producto'} en ${level.warehouse?.name || 'almacén'}`}
                  inputMode="decimal"
                  className={cn('w-full', status === 'invalid' && 'border-red-500')}
                  value={drafts[level.id] ?? ''}
                  onChange={(event) => setDrafts((current) => ({ ...current, [level.id]: event.target.value }))}
                  placeholder="Contado"
                />
                <p className={cn('text-right font-mono text-sm', status === 'difference' && difference < 0 && 'text-red-700', status === 'difference' && difference > 0 && 'text-emerald-700')}>
                  {status === 'difference' ? formatQuantity(difference) : status === 'same' ? '= coincide' : status === 'invalid' ? 'No válido' : ''}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={applyCount.isPending} onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button type="button" disabled={!canApply} onClick={() => applyCount.mutate()}>
            {applyCount.isPending ? 'Guardando…' : `Guardar recuento (${toApply.length} ${toApply.length === 1 ? 'línea' : 'líneas'})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
