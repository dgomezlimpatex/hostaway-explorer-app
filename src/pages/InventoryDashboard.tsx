import { useMemo, type ComponentType } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArchiveRestore,
  ArrowRight,
  Boxes,
  Building2,
  CheckCircle2,
  Droplets,
  Package,
  Settings2,
  Shirt,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StockLayout } from '@/components/stock/StockLayout';
import { MobileStockBottomNav } from '@/components/stock/MobileStockBottomNav';
import { StockWarehouseSelect } from '@/components/stock/StockWarehouseSelect';
import { SedeSelector } from '@/components/sede/SedeSelector';
import { useStockDashboardStats } from '@/hooks/useStock';
import { useDeviceType } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import type { StockLevel } from '@/types/stock';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);

const formatNumber = (value: number) =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(value);

export default function InventoryDashboard() {
  const { isMobile } = useDeviceType();
  const { stats, levels, isLoading } = useStockDashboardStats();

  const stockHealth = useMemo(() => {
    const critical = levels.filter((level) => level.current_quantity <= 0);
    const low = levels.filter(
      (level) => level.current_quantity > 0 && level.current_quantity <= level.minimum_quantity
    );
    const ok = levels.length - critical.length - low.length;
    const healthyPercent = levels.length > 0 ? Math.round((ok / levels.length) * 100) : 100;

    return {
      critical,
      low,
      ok,
      healthyPercent,
      attentionItems: [...critical, ...low].slice(0, 5),
    };
  }, [levels]);

  const categorySummary = useMemo(() => {
    const uniqueProductsByKind = new Map<string, Set<string>>();
    levels.forEach((level) => {
      const kind = level.product?.category?.kind || 'other';
      if (!uniqueProductsByKind.has(kind)) uniqueProductsByKind.set(kind, new Set());
      uniqueProductsByKind.get(kind)?.add(level.product_id);
    });

    return {
      laundry: uniqueProductsByKind.get('laundry')?.size || 0,
      amenity: uniqueProductsByKind.get('amenity')?.size || 0,
      other: uniqueProductsByKind.get('other')?.size || 0,
    };
  }, [levels]);

  const cards = [
    { title: 'Productos', value: stats.totalProducts, icon: Package },
    { title: 'Almacenes', value: stats.totalWarehouses, icon: Building2 },
    { title: 'Stock bajo', value: stats.lowStock, icon: AlertTriangle },
    { title: 'Sin stock', value: stats.criticalStock, icon: AlertTriangle },
  ];

  if (isMobile) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 pb-28">
        <div className="mx-auto max-w-md space-y-4 px-4 py-4">
          <header className="space-y-3">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Stock profesional</p>
                <h1 className="text-2xl font-bold text-slate-950">Inventario</h1>
                <p className="text-sm text-muted-foreground">Lavanderia, amenities y consumibles</p>
              </div>
              <div className="flex justify-start">
                <SedeSelector />
              </div>
            </div>

            <StockWarehouseSelect />
          </header>

          <Card className="overflow-hidden border-0 bg-slate-950 text-white shadow-lg">
            <CardContent className="p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-300">Valor estimado</p>
                  <div className="mt-1 text-3xl font-bold">
                    {isLoading ? '-' : formatCurrency(stats.totalValue)}
                  </div>
                </div>
                <Badge className="border-0 bg-white/10 text-white hover:bg-white/10">
                  {stockHealth.healthyPercent}% OK
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-white/10 p-3">
                  <div className="text-xl font-bold">{isLoading ? '-' : stats.totalProducts}</div>
                  <div className="text-[11px] text-slate-300">Productos</div>
                </div>
                <div className="rounded-xl bg-amber-400/15 p-3">
                  <div className="text-xl font-bold text-amber-200">{isLoading ? '-' : stats.lowStock}</div>
                  <div className="text-[11px] text-amber-100">Bajo</div>
                </div>
                <div className="rounded-xl bg-red-400/15 p-3">
                  <div className="text-xl font-bold text-red-200">{isLoading ? '-' : stats.criticalStock}</div>
                  <div className="text-[11px] text-red-100">Sin stock</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <section className="grid grid-cols-2 gap-3">
            <QuickActionCard
              to="/inventory/stock"
              title="Stock global"
              description="Ver y ajustar"
              icon={Package}
              className="bg-blue-600 text-white"
              iconClassName="text-white"
            />
            <QuickActionCard
              to="/inventory/movements"
              title="Movimientos"
              description="Entradas y salidas"
              icon={ArchiveRestore}
            />
            <QuickActionCard
              to="/inventory/laundry"
              title="Lavanderia"
              description={`${categorySummary.laundry} productos`}
              icon={Shirt}
            />
            <QuickActionCard
              to="/inventory/amenities"
              title="Amenities"
              description={`${categorySummary.amenity} productos`}
              icon={Droplets}
            />
          </section>

          <section className="grid grid-cols-3 gap-2">
            <MetricCard title="Unidades" value={isLoading ? '-' : formatNumber(stats.totalUnits)} />
            <MetricCard title="Almacenes" value={isLoading ? '-' : stats.totalWarehouses} />
            <MetricCard title="Otros" value={isLoading ? '-' : categorySummary.other} />
          </section>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  Necesitan atencion
                </CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/inventory/stock">Ver stock</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {stockHealth.attentionItems.length > 0 ? (
                stockHealth.attentionItems.map((level) => (
                  <StockAttentionRow key={level.id} level={level} />
                ))
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <div>
                      <p className="font-medium text-emerald-950">Todo bajo control</p>
                      <p className="text-sm text-emerald-800">No hay productos criticos ni bajo minimo.</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <section className="grid grid-cols-2 gap-3">
            <SecondaryLink to="/inventory/warehouses" icon={Building2} label="Almacenes" />
            <SecondaryLink to="/inventory/config" icon={Settings2} label="Configuracion" />
          </section>
        </div>

        <MobileStockBottomNav />
      </div>
    );
  }

  return (
    <StockLayout
      title="Dashboard de stock"
      description="Resumen del nuevo sistema profesional de Lavanderia y Amenities."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? '-' : card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Boxes className="h-5 w-5" />
              Unidades totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{isLoading ? '-' : formatNumber(stats.totalUnits)}</div>
            <p className="text-sm text-muted-foreground">Suma del stock visible con el filtro actual.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Valor estimado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{isLoading ? '-' : formatCurrency(stats.totalValue)}</div>
            <p className="text-sm text-muted-foreground">Calculado con el coste unitario configurado.</p>
          </CardContent>
        </Card>
      </div>
    </StockLayout>
  );
}

function QuickActionCard({
  to,
  title,
  description,
  icon: Icon,
  className,
  iconClassName,
}: {
  to: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        'rounded-xl border bg-white p-4 shadow-sm transition active:scale-[0.99]',
        className
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <Icon className={cn('h-5 w-5 text-blue-600', iconClassName)} />
        <ArrowRight className={cn('h-4 w-4 opacity-70', iconClassName)} />
      </div>
      <p className="font-semibold">{title}</p>
      <p className={cn('text-xs', className ? 'text-white/80' : 'text-muted-foreground')}>{description}</p>
    </Link>
  );
}

function MetricCard({ title, value }: { title: string; value: number | string }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-3">
        <p className="text-[11px] text-muted-foreground">{title}</p>
        <p className="mt-1 truncate text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function StockAttentionRow({ level }: { level: StockLevel }) {
  const isCritical = level.current_quantity <= 0;

  return (
    <Link
      to="/inventory/stock"
      className="flex items-center justify-between gap-3 rounded-xl border bg-white p-3 transition active:scale-[0.99]"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{level.product?.name || 'Producto sin nombre'}</p>
        <p className="truncate text-xs text-muted-foreground">
          {level.warehouse?.name || 'Almacen'} - Min. {formatNumber(level.minimum_quantity)}
        </p>
      </div>
      <div className="text-right">
        <Badge
          className={cn(
            'border-0',
            isCritical ? 'bg-red-100 text-red-800 hover:bg-red-100' : 'bg-amber-100 text-amber-800 hover:bg-amber-100'
          )}
        >
          {isCritical ? 'Critico' : 'Bajo'}
        </Badge>
        <p className="mt-1 text-xs font-medium text-slate-700">{formatNumber(level.current_quantity)}</p>
      </div>
    </Link>
  );
}

function SecondaryLink({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Button asChild variant="outline" className="h-12 justify-between rounded-xl bg-white">
      <Link to={to}>
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-blue-600" />
          {label}
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </Link>
    </Button>
  );
}
