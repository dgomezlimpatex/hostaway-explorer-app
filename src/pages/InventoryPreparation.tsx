import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StockLayout } from '@/components/stock/StockLayout';
import { useInventoryWorkspace } from '@/features/inventory/useInventoryWorkspace';
import { BagList, InventoryEmpty, InventoryPanel, InventoryPeriod, WorkspaceNotice } from '@/features/inventory/InventoryComponents';
import { normalizeMaterial } from '@/features/inventory/inventoryDomain';

export default function InventoryPreparation() {
  const [days, setDays] = useState(3);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('pending');
  const w = useInventoryWorkspace(days);
  const bags = w.bags.filter(b => normalizeMaterial(b.propertyCode).includes(normalizeMaterial(search)) && (filter === 'all' || filter === 'pending' && !['prepared', 'delivered'].includes(b.state) || filter === b.state || filter === 'issue' && b.state === 'review'));
  const groups = [...new Set(bags.map(b => b.warehouseId))].map(id => ({ id, name: id ? w.warehouses.find(item => item.id === id)?.name ?? 'Ubicación por comprobar' : 'Destino por comprobar', bags: bags.filter(b => b.warehouseId === id) }));
  return <StockLayout title="Mudas y reparto" description="Contenido por limpieza, preparación y entregas confirmadas. Una misma muda aparece una sola vez.">
    <WorkspaceNotice workspace={w} />
    {!w.stockLoading && !w.stockError && <>
      <div className="flex flex-wrap items-center justify-between gap-3"><InventoryPeriod days={days} onChange={setDays} from={w.from} to={w.to} /><Button asChild><Link to="/lavanderia/nuevo-sistema">Abrir ruta de preparación</Link></Button></div>
      <InventoryPanel title="Estado de las mudas" description="Las incidencias y los cambios de contenido permanecen visibles hasta que se revisen.">
        <div className="flex flex-wrap gap-2 p-4">{[['pending', 'Por preparar'], ['prepared', 'Preparadas'], ['delivered', 'Entrega confirmada'], ['issue', 'Incidencias'], ['all', 'Todas']].map(([value, label]) => <Button size="sm" key={value} aria-pressed={filter === value} variant={filter === value ? 'default' : 'outline'} onClick={() => setFilter(value)}>{label}</Button>)}<Input aria-label="Buscar propiedad" placeholder="Buscar propiedad…" className="mt-2" value={search} onChange={e => setSearch(e.target.value)} /></div>
        {!w.demandReady ? <InventoryEmpty>{w.demandError ? 'No se pudieron cargar las mudas. Reintenta la consulta.' : 'Consultando limpiezas y preparación…'}</InventoryEmpty> : !bags.length ? <InventoryEmpty>No hay mudas con estos filtros en el período seleccionado.</InventoryEmpty> : <div className="space-y-3 px-4 pb-4">{groups.map(group => <details key={group.id ?? 'unassigned'} className="rounded-xl border"><summary className="cursor-pointer px-4 py-4 text-sm font-semibold">{group.name.replace(/^TRASTERO\s*-\s*/i, '')} <span className="ml-2 font-normal text-muted-foreground">{group.bags.length} mudas · {group.bags[0].date.split('-').reverse().join('/')}</span></summary><BagList bags={group.bags} /></details>)}</div>}
      </InventoryPanel>
      <p className="text-xs leading-relaxed text-muted-foreground">Este resumen consulta las limpiezas activas desde hoy. Las reservas sin limpieza asignada y el material ya utilizado requieren comprobación física. Las acciones de preparación siguen en la ruta existente; consultar esta página no cambia bolsas ni existencias.</p>
    </>}
  </StockLayout>;
}
