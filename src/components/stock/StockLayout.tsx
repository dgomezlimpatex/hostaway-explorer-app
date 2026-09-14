import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ArchiveRestore, BarChart3, Boxes, Building2, ClipboardList, Droplets, Package, Settings2, Shirt } from 'lucide-react';
import { SedeSelector } from '@/components/sede/SedeSelector';
import { cn } from '@/lib/utils';
import { StockWarehouseSelect } from './StockWarehouseSelect';
import './inventory.css';

const stockItems = [
  { title: 'Resumen', href: '/inventory', icon: BarChart3 },
  { title: 'Stock global', href: '/inventory/stock', icon: Package },
  { title: 'Lavandería', href: '/inventory/laundry', icon: Shirt },
  { title: 'Amenities', href: '/inventory/amenities', icon: Droplets },
  { title: 'Almacenes', href: '/inventory/warehouses', icon: Building2 },
  { title: 'Movimientos', href: '/inventory/movements', icon: ArchiveRestore },
  { title: 'Informes', href: '/inventory/reports', icon: ClipboardList },
  { title: 'Configuración', href: '/inventory/config', icon: Settings2 },
];
interface StockLayoutProps { title?: string; description?: string; children: ReactNode; actions?: ReactNode; showWarehouseSelect?: boolean; }
export function StockLayout({ title = 'Inventario', description, children, actions, showWarehouseSelect = true }: StockLayoutProps) {
  const location = useLocation();
  const Icon = stockItems.find(item => item.href === location.pathname)?.icon || Boxes;
  return <div className="inventory-workspace min-h-screen bg-slate-50/60">
    <header className="border-b border-border/60 bg-background/90">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm"><Icon className="h-5 w-5" /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Inventario · Limpatex</p><h1 className="mt-0.5 text-xl font-bold tracking-tight sm:text-2xl">{title}</h1></div></div>
        <SedeSelector />
        {description && <p className="w-full text-sm text-muted-foreground">{description}</p>}
      </div>
      <nav aria-label="Secciones de inventario" className="mx-auto flex max-w-[1440px] gap-1 overflow-x-auto px-4 pb-3 sm:px-6 lg:px-8">
        {stockItems.map(item => <NavLink end key={item.href} to={item.href} className={({ isActive }) => cn('flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}><item.icon className="h-4 w-4" />{item.title}</NavLink>)}
      </nav>
    </header>
    <div className="mx-auto max-w-[1440px] space-y-5 p-4 sm:p-6 lg:p-8">
      {(showWarehouseSelect || actions) && <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-border/60 bg-background p-4">{showWarehouseSelect && <div className="min-w-0"><p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">Consultar almacén</p><StockWarehouseSelect /></div>}<div className="flex flex-wrap items-center gap-2">{actions}</div></div>}
      {children}
    </div>
  </div>;
}
