import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  ArchiveRestore,
  BarChart3,
  Boxes,
  Building2,
  Droplets,
  Home,
  Menu,
  Package,
  Settings2,
  Shirt,
} from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

const stockItems = [
  { title: 'Dashboard', href: '/inventory', icon: BarChart3 },
  { title: 'Stock global', href: '/inventory/stock', icon: Package },
  { title: 'Lavanderia', href: '/inventory/laundry', icon: Shirt },
  { title: 'Amenities', href: '/inventory/amenities', icon: Droplets },
  { title: 'Almacenes', href: '/inventory/warehouses', icon: Building2 },
  { title: 'Movimientos', href: '/inventory/movements', icon: ArchiveRestore },
  { title: 'Configuracion', href: '/inventory/config', icon: Settings2 },
];

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition-colors',
    isActive ? 'text-blue-700' : 'text-muted-foreground'
  );

export function MobileStockBottomNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-4 items-end gap-1">
        <NavLink to="/" className={navItemClass}>
          <Home className="h-5 w-5" />
          <span>Inicio</span>
        </NavLink>

        <NavLink to="/inventory" end className={navItemClass}>
          <BarChart3 className="h-5 w-5" />
          <span>Resumen</span>
        </NavLink>

        <NavLink to="/inventory/stock" className={navItemClass}>
          <Package className="h-5 w-5" />
          <span>Stock</span>
        </NavLink>

        <Drawer open={menuOpen} onOpenChange={setMenuOpen}>
          <DrawerTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition-colors',
                pathname.startsWith('/inventory') && pathname !== '/inventory' && pathname !== '/inventory/stock'
                  ? 'text-blue-700'
                  : 'text-muted-foreground'
              )}
            >
              <Menu className="h-5 w-5" />
              <span>Menu</span>
            </button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Stock profesional</DrawerTitle>
            </DrawerHeader>
            <div className="max-h-[70vh] overflow-y-auto px-4 pb-6">
              <NavLink
                to="/"
                onClick={() => setMenuOpen(false)}
                className="mb-4 flex items-center gap-3 rounded-xl border bg-white px-4 py-3 text-sm font-medium text-slate-700"
              >
                <Home className="h-4 w-4 text-blue-600" />
                Dashboard principal
              </NavLink>

              <div className="mb-3 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Boxes className="h-4 w-4" />
                Inventario
              </div>

              <div className="space-y-1">
                {stockItems.map((item) => (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    end={item.href === '/inventory'}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors',
                        isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                      )
                    }
                  >
                    <item.icon className="h-5 w-5" />
                    {item.title}
                  </NavLink>
                ))}
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </nav>
  );
}
