import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Building2, CheckCircle2, Droplets, Package, Shirt, ArchiveRestore } from 'lucide-react';
import { StockLayout } from '@/components/stock/StockLayout';
import { useStockDashboardStats } from '@/hooks/useStock';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
const number = (value: number) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(value);
export default function InventoryDashboard() {
  const { stats, levels, isLoading } = useStockDashboardStats();
  const attention = levels.filter(level => level.current_quantity <= level.minimum_quantity).sort((a, b) => a.current_quantity - b.current_quantity);
  return <StockLayout title="Resumen de inventario" description="Existencias, reposición y actividad de lavandería y consumibles.">
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[
      { title: 'Productos', value: stats.totalProducts, icon: Package, to: '/inventory/stock', tone: 'text-primary bg-primary/10' },
      { title: 'Almacenes', value: stats.totalWarehouses, icon: Building2, to: '/inventory/warehouses', tone: 'text-primary bg-primary/10' },
      { title: 'Stock bajo', value: stats.lowStock, icon: AlertTriangle, to: '/inventory/stock?status=low', tone: 'text-amber-700 bg-amber-50' },
      { title: 'Sin stock', value: stats.criticalStock, icon: AlertTriangle, to: '/inventory/stock?status=empty', tone: 'text-red-700 bg-red-50' },
    ].map(item => <Link key={item.title} to={item.to} className="rounded-2xl border border-border/60 bg-background p-4 shadow-sm transition-colors hover:border-primary/40"><div className="flex items-center justify-between"><span className={cn('rounded-xl p-2', item.tone)}><item.icon className="h-4 w-4" /></span><ArrowRight className="h-4 w-4 text-muted-foreground" /></div><p className="mt-4 text-3xl font-bold tracking-tight">{isLoading ? '—' : item.value}</p><p className="mt-1 text-xs text-muted-foreground">{item.title}</p></Link>)}</div>
    <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
      <section className="rounded-2xl border border-border/60 bg-background p-5 shadow-sm"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-semibold">Prioridad de reposición</h2><p className="mt-1 text-xs text-muted-foreground">Productos en mínimo o sin existencias</p></div><Button asChild size="sm" variant="outline"><Link to="/inventory/stock?status=attention">Ver todos</Link></Button></div>
        {isLoading ? <p role="status" className="py-8 text-center text-sm text-muted-foreground">Consultando existencias…</p> : !levels.length ? <p className="py-8 text-center text-sm text-muted-foreground">Todavía no hay stock registrado para este almacén.</p> : !attention.length ? <div className="rounded-xl bg-emerald-50 p-6 text-sm text-emerald-800"><CheckCircle2 className="mb-2 h-6 w-6" />No hay productos por debajo del mínimo.</div> : <div className="divide-y">{attention.slice(0, 6).map(level => <Link key={level.id} to="/inventory/stock?status=attention" className="flex items-center gap-3 py-3"><span className={cn('h-2 w-2 shrink-0 rounded-full', level.current_quantity <= 0 ? 'bg-red-500' : 'bg-amber-500')} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{level.product?.name || 'Producto'}</p><p className="text-xs text-muted-foreground">{level.warehouse?.name} · Mínimo {number(level.minimum_quantity)}</p></div><div className="text-right"><p className="font-mono font-semibold">{number(level.current_quantity)}</p><p className="text-[10px] text-muted-foreground">{level.product?.unit_of_measure}</p></div></Link>)}</div>}
      </section>
      <section className="space-y-3"><h2 className="text-sm font-semibold">Operaciones de inventario</h2>{[
        { title: 'Lavandería', subtitle: 'Lencería y textiles por almacén', to: '/inventory/laundry', icon: Shirt },
        { title: 'Amenities', subtitle: 'Productos de acogida y consumibles', to: '/inventory/amenities', icon: Droplets },
        { title: 'Movimientos', subtitle: 'Revisar entradas, salidas y ajustes', to: '/inventory/movements', icon: ArchiveRestore },
      ].map(item => <Link key={item.to} to={item.to} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background p-4 hover:border-primary/40"><span className="rounded-xl bg-primary/10 p-2.5 text-primary"><item.icon className="h-5 w-5" /></span><div className="flex-1"><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.subtitle}</p></div><ArrowRight className="h-4 w-4 text-muted-foreground" /></Link>)}
        <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4"><p className="text-xs font-medium text-muted-foreground">Valor del stock seleccionado</p><p className="mt-2 text-2xl font-bold">{isLoading ? '—' : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(stats.totalValue)}</p><p className="mt-1 text-xs text-muted-foreground">{number(stats.totalUnits)} unidades · Según costes configurados</p></div>
      </section>
    </div>
  </StockLayout>;
}
