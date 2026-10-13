import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Boxes, ChevronDown } from 'lucide-react';
import { SedeSelector } from '@/components/sede/SedeSelector';
import { cn } from '@/lib/utils';
import { StockWarehouseSelect } from './StockWarehouseSelect';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import './inventory.css';

const inventoryNavigation = [
  { title: 'Resumen', href: '/inventory' },
  { title: 'Almacén central', href: '/inventory/stock' },
  { title: 'Mudas y reparto', href: '/inventory/preparation' },
  { title: 'Edificios', href: '/inventory/warehouses' },
];
const secondary = [
  { title: 'Historial de movimientos', href: '/inventory/movements' },
  { title: 'Informes y exportaciones', href: '/inventory/reports' },
  { title: 'Configuración', href: '/inventory/config' },
  { title: 'Gestionar ubicaciones', href: '/inventory/warehouses?manage=1' },
];
interface StockLayoutProps { title?: string; description?: string; children: ReactNode; actions?: ReactNode; showWarehouseSelect?: boolean; }
export function StockLayout({ title = 'Inventario', description, children, actions, showWarehouseSelect = false }: StockLayoutProps) {
  const { pathname } = useLocation();
  return <div className="inventory-workspace min-h-screen bg-[#f7f6fa]">
    <header className="border-b border-primary/10 bg-background">
      <div className="mx-auto max-w-[1320px] px-4 pt-6 sm:px-8">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="min-w-0"><Link to="/inventory" className="mb-2 inline-flex items-center gap-2 text-xs font-semibold text-primary"><Boxes className="h-4 w-4" />Inventario · Limpatex</Link><h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>}</div>
          <div className="shrink-0"><SedeSelector /></div>
        </div>
        <nav aria-label="Secciones de inventario" className="flex flex-wrap items-center gap-1 pb-3">
          {inventoryNavigation.map(item => {
            const active = item.href === pathname || item.href === '/inventory/stock' && ['/inventory/laundry', '/inventory/amenities'].includes(pathname);
            return <Link key={item.href} to={item.href} aria-current={active ? 'page' : undefined} className={cn('rounded-xl px-3 py-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-4 sm:text-sm', active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-primary/5 hover:text-primary')}>{item.title}</Link>;
          })}
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="ml-auto">Más<ChevronDown className="ml-1 h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">{secondary.map(item => <DropdownMenuItem key={item.href} asChild><Link to={item.href}>{item.title}</Link></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
        </nav>
      </div>
    </header>
    <div className="mx-auto max-w-[1320px] space-y-5 p-4 sm:p-8">
      {(showWarehouseSelect || actions) && <div className="flex flex-wrap items-center justify-between gap-3">{showWarehouseSelect && <div><p className="mb-1 text-xs text-muted-foreground">Consultar ubicación</p><StockWarehouseSelect /></div>}{actions && <div className="flex flex-wrap gap-2">{actions}</div>}</div>}
      {children}
    </div>
  </div>;
}
