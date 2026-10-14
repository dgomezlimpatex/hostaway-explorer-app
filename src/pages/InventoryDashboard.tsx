import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, ClipboardList, PackageOpen } from 'lucide-react';
import { StockLayout } from '@/components/stock/StockLayout';
import { useInventoryWorkspace } from '@/features/inventory/useInventoryWorkspace';
import { InventoryBadge, InventoryEmpty, InventoryLink, InventoryPanel, InventoryPeriod, WorkspaceNotice } from '@/features/inventory/InventoryComponents';
import { levelState, quantity } from '@/features/inventory/inventoryDomain';
import { ProvisionalInventoryPanel } from '@/features/inventory/ProvisionalInventoryPanel';
export default function InventoryDashboard() {
  const [days, setDays] = useState(3);
  const w = useInventoryWorkspace(days);
  const attention = w.centralLevels.map(level => ({ level, ...levelState(level, w.demand.get(level.product_id)) })).filter(item => ['shortage', 'replenish'].includes(item.state));
  const missingProducts = w.demandReady ? w.products.filter(p => w.demand.has(p.id) && !w.centralLevels.some(l => l.product_id === p.id)) : [];
  const pending = w.bags.filter(b => !['prepared', 'delivered'].includes(b.state)).length;
  const prepared = w.bags.filter(b => b.state === 'prepared').length;
  const issues = w.bags.filter(b => ['issue', 'review'].includes(b.state)).length;
  return <StockLayout title="Tu inventario, de un vistazo" description="Empieza por el almacén central y continúa con lo que necesita el próximo reparto.">
    <WorkspaceNotice workspace={w} />
    {!w.stockLoading && !w.stockError && <>
      {w.central && !w.bagAccounting?.active && <ProvisionalInventoryPanel warehouseId={w.central.id} products={w.products} levels={w.centralLevels} cycleActive={w.cycleActive} refreshStock={w.refresh} />}
      <InventoryPeriod days={days} onChange={setDays} from={w.from} to={w.to} />
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-2xl bg-primary p-6 text-primary-foreground sm:p-8"><p className="text-sm text-white/70">Centro de distribución</p><h2 className="mt-2 text-2xl font-bold">{w.central?.name ?? 'Almacén central por identificar'}</h2><p className="mt-3 max-w-lg text-sm leading-relaxed text-white/85">{!w.central ? 'Revisa las ubicaciones antes de calcular necesidades.' : attention.length ? `${attention.length} ${attention.length === 1 ? 'producto necesita' : 'productos necesitan'} revisión de existencias o reposición.` : 'Revisa las reservas y el material necesario antes de preparar las bolsas.'}</p><Link to="/inventory/stock" className="mt-6 inline-flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-bold text-primary">Abrir almacén central<ArrowRight className="h-4 w-4" /></Link></section>
        <InventoryPanel title="Preparación de mudas" description="Para las limpiezas del período seleccionado" action={<InventoryLink to="/inventory/preparation">Ver mudas</InventoryLink>}>
          <div className="grid grid-cols-3 gap-2 p-5">{[['Por preparar', pending], ['Preparadas', prepared], ['Por revisar', issues]].map(([label, value]) => <div key={label}><p className="text-3xl font-bold tabular-nums">{w.demandReady ? value : '—'}</p><p className="mt-2 text-xs text-muted-foreground">{label}</p></div>)}</div><p className="px-5 pb-5 text-xs text-muted-foreground">{w.demandReady ? 'Las preparadas tienen la entrega sin confirmar. Por revisar está incluido en Por preparar.' : 'Pendiente de consultar las mudas; no se interpreta como cero.'}</p>
        </InventoryPanel>
      </div>
      <InventoryPanel title="Qué necesita atención" description="Necesidades del almacén central. Los ceros sin reserva se revisan aparte." action={<InventoryLink to="/inventory/stock?status=attention">Ver necesidades</InventoryLink>}>
        {!w.central ? <InventoryEmpty>Identifica el almacén central para consultar sus necesidades.</InventoryEmpty> : !attention.length && !missingProducts.length ? <InventoryEmpty>{w.demandReady ? 'No se detectan faltantes en los saldos y reservas registrados. Comprueba las cantidades físicas antes de repartir.' : 'Aún no se pueden valorar todas las necesidades del reparto.'}</InventoryEmpty> : <div className="divide-y">{attention.map(item => <Link key={item.level.id} to={`/inventory/stock?product=${item.level.product_id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-primary/[.025]"><div><p className="text-sm font-semibold">{item.level.product?.name}</p><p className="mt-1 text-xs text-muted-foreground">Registrado: {quantity(item.level.current_quantity)} · {item.state === 'shortage' ? `Por preparar: ${quantity(w.demand.get(item.level.product_id) ?? 0)}` : `Reserva deseada: ${quantity(Math.max(item.level.minimum_quantity, item.level.target_quantity))}`}</p></div><InventoryBadge state={item.state}>{item.label}</InventoryBadge></Link>)}{missingProducts.map(p => <div key={p.id} className="flex flex-wrap justify-between gap-2 p-5 text-sm"><strong>{p.name}</strong><InventoryBadge state="unknown">Sin saldo en el almacén central</InventoryBadge></div>)}</div>}
      </InventoryPanel>
      <div className="grid gap-3 sm:grid-cols-3">{[
        { to: '/inventory/warehouses', icon: Building2, title: 'Edificios', detail: `${w.buildings.filter(b => b.needsAttention).length} con necesidades conocidas · mudas y repuestos` },
        { to: '/inventory/stock?status=unknown', icon: PackageOpen, title: 'Comprobar reservas', detail: `${w.centralLevels.filter(l => levelState(l).state === 'unknown').length} productos sin reserva definida o con saldo por revisar` },
        { to: '/inventory/movements', icon: ClipboardList, title: 'Consultar historial', detail: 'Entradas, salidas, recuentos y traslados' },
      ].map(item => <Link key={item.to} to={item.to} className="flex gap-3 rounded-xl border bg-white p-5 hover:border-primary/40"><item.icon className="mt-1 h-5 w-5 shrink-0 text-primary" /><div><h2 className="text-sm font-semibold">{item.title}</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p></div></Link>)}</div>
    </>}
  </StockLayout>;
}
