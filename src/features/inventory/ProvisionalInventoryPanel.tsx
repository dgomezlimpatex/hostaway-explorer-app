import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useSede } from '@/contexts/SedeContext';
import { useAuth } from '@/hooks/useAuth';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { Button } from '@/components/ui/button';
import { formatMadridDate } from '@/utils/date';
import type { StockLevel, StockProduct } from '@/types/stock';
import { addInventoryDays, quantity } from './inventoryDomain';
import { buildProvisionalInventory, suggestedProvisionalDate, validProvisionalDate } from './provisionalInventory';
import { readProvisionalInventory } from './provisionalInventoryReads';

interface Props { warehouseId: string; products: StockProduct[]; levels: StockLevel[]; cycleActive: boolean; refreshStock: () => unknown; }
export function ProvisionalInventoryPanel({ warehouseId, products, levels, cycleActive, refreshStock }: Props) {
  const { activeSede } = useSede();
  const { user } = useAuth();
  const { isAdminOrManager } = useRolePermissions();
  const canReadHistory = isAdminOrManager();
  const [params, setParams] = useSearchParams();
  const today = formatMadridDate(new Date());
  const fallback = addInventoryDays(today, -30);
  const requested = params.get('seguimientoDesde');
  const invalid = !!requested && (!validProvisionalDate(requested) || requested > today);
  // A UTC day before the requested business date also covers Madrid midnight in summer and winter.
  const earliest = addInventoryDays(requested && !invalid ? requested : fallback, -1);
  const query = useQuery({
    queryKey: ['provisional-inventory', activeSede?.id, user?.id, warehouseId, earliest],
    queryFn: () => readProvisionalInventory(activeSede!.id, warehouseId, earliest),
    enabled: !!activeSede?.id && canReadHistory && !invalid, staleTime: 30000, refetchInterval: 60000, retry: 1,
  });
  const from = requested ?? suggestedProvisionalDate(query.data?.movements ?? [], fallback);
  const calculated = useMemo(() => {
    if (!query.data || invalid || query.isError) return { report: null, error: null };
    try { return { report: buildProvisionalInventory(query.data, products, query.data.levels as unknown as StockLevel[] ?? levels, warehouseId, from), error: null }; }
    catch (error) { return { report: null, error: error instanceof Error ? error.message : 'No se pudo calcular el seguimiento.' }; }
  }, [query.data, query.isError, products, levels, warehouseId, from, invalid]);
  const report = calculated.report;
  const failed = query.isError || !!calculated.error;
  const refresh = () => { void query.refetch(); void refreshStock(); };
  // Existing history policies allow complete reads to administration and management.
  if (!canReadHistory) return null;
  return <section aria-labelledby="provisional-inventory-title" className="overflow-hidden rounded-[.625rem] border bg-white">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b px-4 py-3">
      <div className="max-w-2xl"><p className="text-[13px] font-medium text-primary">Mientras completamos el recuento</p><h2 id="provisional-inventory-title" className="text-[15px] font-semibold text-slate-950">Seguimiento provisional</h2><p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">Compara la ropa recibida con las bolsas nuevas desde la fecha elegida. La ropa anterior queda pendiente de contar; una diferencia negativa no significa que el almacén esté vacío.</p>{cycleActive && <p className="mt-2 text-sm font-medium text-primary">El circuito completo está activo. Esta comparación es histórica; consulta las existencias del almacén para repartir.</p>}</div>
      <div className="flex flex-wrap items-end gap-2"><label className="text-xs font-medium">Desde el día<input aria-label="Inicio del seguimiento provisional" type="date" max={today} value={from} onChange={event => { const next = new URLSearchParams(params); next.set('seguimientoDesde', event.target.value || fallback); setParams(next, { replace: true }); }} className="mt-1 block min-h-10 rounded-lg border bg-white px-3 text-sm" /></label><Button variant="outline" size="sm" onClick={refresh} disabled={query.isFetching || invalid}><RefreshCw className="mr-2 h-4 w-4" />Actualizar seguimiento</Button></div>
    </div>
    {invalid ? <p role="alert" className="p-5 text-sm text-destructive">Elige una fecha válida que no sea futura.</p> : failed ? <div role="alert" className="p-5 text-sm"><p>No se pudo consultar el seguimiento completo. Los saldos anteriores no se muestran como actuales.</p><p className="mt-1 text-muted-foreground">{calculated.error ?? 'Reintenta la consulta.'}</p><Button className="mt-3" variant="outline" onClick={refresh}>Reintentar seguimiento</Button></div> : !report ? <p role="status" className="p-5 text-sm text-muted-foreground">Consultando entradas y preparaciones…</p> : <>
      <div className="px-4 py-2.5 text-[13px] text-muted-foreground">{report.receiptDays.length} días con recepción confirmada · {report.freshBags} bolsas nuevas registradas. {report.priorBags > 0 && `${report.priorBags} bolsas preparadas antes del inicio quedan fuera.`} {report.repeatedEvents > 0 && `${report.repeatedEvents} marcas repetidas contadas una sola vez.`}</div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Ropa recibida y preparada desde {from}</caption><thead className="bg-primary/5 text-left text-xs text-muted-foreground"><tr><th className="px-5 py-3">Ropa</th><th className="px-3 py-3 text-right">Recibida</th><th className="px-3 py-3 text-right">En bolsas nuevas</th><th className="px-5 py-3 text-right">Diferencia</th></tr></thead><tbody className="divide-y">{report.linen.map(line => <tr key={line.productId}><th scope="row" className="px-5 py-3 text-left font-medium">{line.name}</th><td className="px-3 py-3 text-right tabular-nums">{quantity(line.received)}</td><td className="px-3 py-3 text-right tabular-nums">{line.packed === null ? 'Sin detalle' : quantity(line.packed)}</td><td className={`px-5 py-3 text-right font-semibold tabular-nums ${line.difference !== null && line.difference < 0 ? 'text-amber-700' : ''}`}>{line.difference === null ? 'Por comprobar' : quantity(line.difference)}</td></tr>)}</tbody></table></div>
      <p className="px-5 pb-5 pt-3 text-xs leading-relaxed text-muted-foreground">Se actualiza cada minuto mientras esta pantalla está abierta y al volver a ella. Usa las correcciones confirmadas y la última composición registrada de cada bolsa. El historial no acredita devoluciones ni desempaquetados; esta diferencia no modifica las existencias ni bloquea el reparto.</p>
      {report.supplies.length > 0 && <details className="border-t"><summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-primary">Amenities y consumibles · revisar los descuentos existentes</summary><p className="px-5 pb-4 text-sm text-muted-foreground">El saldo registrado ya incluye los descuentos de limpieza. No se vuelve a restar el contenido de las bolsas. Comprueba las tareas anteriores al inicio: pueden haber descontado parte de las cantidades recién añadidas.</p><div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Cantidades introducidas y saldos registrados de amenities y consumibles</caption><thead className="bg-primary/5 text-xs text-muted-foreground"><tr><th className="px-5 py-3 text-left">Producto</th><th className="px-3 py-3 text-right">Última cantidad introducida</th><th className="px-3 py-3 text-right">Saldo registrado</th><th className="px-5 py-3 text-right">Estimado de tareas anteriores</th></tr></thead><tbody className="divide-y">{report.supplies.map(line => <tr key={line.productId}><th scope="row" className="px-5 py-3 text-left font-medium">{line.name}{line.enteredAt && <span className="mt-1 block text-xs font-normal text-muted-foreground">{formatMadridDate(new Date(line.enteredAt))}</span>}</th><td className="px-3 py-3 text-right tabular-nums">{line.entered === null ? 'Sin registro' : quantity(line.entered)}</td><td className="px-3 py-3 text-right tabular-nums">{line.registered === null ? 'Sin saldo' : quantity(line.registered)}</td><td className="px-5 py-3 text-right tabular-nums">{quantity(line.historical)}</td></tr>)}</tbody></table></div><p className="p-5 text-xs text-muted-foreground">La última cantidad introducida es el saldo tras la entrada o el ajuste. El consumo estimado de tareas anteriores se muestra como aviso; no es una segunda resta ni un recuento físico.</p></details>}
    </>}
  </section>;
}
