import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
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
  { title: 'Historial', href: '/inventory/movements' },
];
const secondary = [
  { title: 'Informes y exportaciones', href: '/inventory/reports' },
  { title: 'Configuración', href: '/inventory/config' },
  { title: 'Gestionar ubicaciones', href: '/inventory/warehouses?manage=1' },
];
interface StockLayoutProps { title?: string; description?: string; children: ReactNode; actions?: ReactNode; showWarehouseSelect?: boolean; }
export function StockLayout({ title = 'Inventario', description, children, actions, showWarehouseSelect = false }: StockLayoutProps) {
  const { pathname, search } = useLocation();
  const managing = pathname === '/inventory/warehouses' && new URLSearchParams(search).get('manage') === '1';
  return <div className="inventory-workspace min-h-screen bg-background">
    <header className="border-b bg-white">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6">
        <div className="flex items-start justify-between gap-3 pt-4">
          <div className="min-w-0"><p className="text-[13px] font-medium text-primary">Inventario</p><h1 className="truncate text-xl font-bold tracking-tight text-slate-950">{title}</h1>{description && <p className="mt-0.5 max-w-3xl text-[13px] text-muted-foreground">{description}</p>}</div>
          <div className="shrink-0 pt-1"><SedeSelector /></div>
        </div>
        <nav aria-label="Secciones de inventario" className="-mx-1 mt-2 flex items-center gap-1">
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
            {inventoryNavigation.map(item => {
              const active = !managing && (item.href === pathname || item.href === '/inventory/stock' && ['/inventory/laundry', '/inventory/amenities', '/inventory/laundry/receipts'].includes(pathname));
              return <Link key={item.href} to={item.href} aria-current={active ? 'page' : undefined} className={cn('relative whitespace-nowrap rounded-md px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', active ? 'text-primary after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary' : 'text-muted-foreground hover:text-slate-950')}>{item.title}</Link>;
            })}
          </div>
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className={cn('h-10 shrink-0', ['/inventory/reports', '/inventory/config'].includes(pathname) || managing ? 'text-primary' : 'text-muted-foreground')}>Más<ChevronDown className="ml-1 h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">{secondary.map(item => <DropdownMenuItem key={item.href} asChild><Link to={item.href}>{item.title}</Link></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
        </nav>
      </div>
    </header>
    <div className="mx-auto max-w-[1320px] space-y-4 px-4 py-4 sm:px-6 sm:py-5">
      {(showWarehouseSelect || actions) && <div className="flex flex-wrap items-center justify-between gap-3">{showWarehouseSelect && <div><p className="mb-1 text-xs text-muted-foreground">Consultar ubicación</p><StockWarehouseSelect /></div>}{actions && <div className="flex flex-wrap gap-2">{actions}</div>}</div>}
      {children}
    </div>
  </div>;
}
