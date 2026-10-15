import { Link } from 'react-router-dom';
import { StockLayout } from '@/components/stock/StockLayout';
import { useInventoryWorkspace } from '@/features/inventory/useInventoryWorkspace';
import { useInventoryDays } from '@/features/inventory/useInventoryDays';
import { EmptyState, PeriodSelect, Section, StatusChip, WorkspaceStatus } from '@/features/inventory/InventoryComponents';
import { bagCounts, inventoryActions } from '@/features/inventory/inventoryViews';
import { ProvisionalInventoryPanel } from '@/features/inventory/ProvisionalInventoryPanel';

export default function InventoryDashboard() {
  const [days, setDays] = useInventoryDays();
  const w = useInventoryWorkspace(days);
  const missingProducts = w.demandReady ? w.products.filter(p => w.demand.has(p.id) && !w.centralLevels.some(l => l.product_id === p.id)) : [];
  const actions = inventoryActions({ ...w, missingProducts });
  const counts = bagCounts(w.bags);
  const bagLinks: Array<[string, string, number]> = [['pending', 'Por preparar', counts.pending], ['issue', 'Incidencias o revisión', counts.issue], ['prepared', 'Preparadas, sin entrega confirmada', counts.prepared], ['delivered', 'Entrega confirmada', counts.delivered]];
  return <StockLayout title="Resumen" description={w.central ? `Qué hacer hoy en ${w.central.name} y en los edificios.` : undefined}>
    <div className="flex flex-wrap items-center justify-between gap-3"><PeriodSelect days={days} onChange={setDays} from={w.from} to={w.to} /></div>
    <WorkspaceStatus workspace={w} />
    {!w.stockLoading && !w.stockError && <>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Section id="inventory-actions" title="Qué hacer ahora" meta={w.demandReady ? 'Ordenado por urgencia. Cada fila indica el motivo.' : 'Mudas sin consultar: las faltas para el reparto no se pueden valorar todavía.'}>
          {!actions.length ? <EmptyState>{w.demandReady ? 'No hay faltas, reposiciones ni mudas pendientes con los saldos registrados. Comprueba las cantidades físicas antes de repartir.' : 'Aún no se pueden valorar las necesidades del reparto.'}</EmptyState>
            : <ol className="divide-y">{actions.map(item => <li key={item.id}>
              <Link to={item.to} className="inv-row-button group grid gap-x-4 gap-y-1 px-4 py-3 hover:bg-primary/[.03] sm:grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:items-center">
                <StatusChip tone={item.tone} className="justify-self-start">{item.chip}</StatusChip>
                <span className="min-w-0"><span className="block text-sm font-semibold text-slate-950">{item.title}</span><span className="block text-[13px] text-muted-foreground">{item.reason}</span></span>
                <span className="text-sm font-semibold text-primary group-hover:underline">{item.action} →</span>
              </Link></li>)}</ol>}
        </Section>
        <Section id="inventory-bags" title="Mudas del período" meta={w.demandReady ? 'Una misma muda se cuenta una sola vez.' : w.demandError ? 'No se pudieron consultar.' : 'Consultando…'}>
          <ul className="divide-y">{bagLinks.map(([estado, label, value]) => <li key={estado}><Link to={`/inventory/preparation?estado=${estado}`} className="inv-row-button flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-primary/[.03]"><span>{label}</span><span className="inv-num">{w.demandReady ? value : '—'}</span></Link></li>)}</ul>
          <p className="border-t px-4 py-2.5 text-[13px] text-muted-foreground">Por preparar incluye las que están por revisar.</p>
        </Section>
      </div>
      {w.central && !w.bagAccounting?.active && <ProvisionalInventoryPanel warehouseId={w.central.id} products={w.products} levels={w.centralLevels} cycleActive={w.cycleActive} refreshStock={w.refresh} />}
    </>}
  </StockLayout>;
}
