import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { CalendarDays, Home, Menu, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { MobileDashboardSidebar } from '@/components/dashboard/MobileDashboardSidebar';
import { MobileCreateActions } from './MobileCreateActions';

interface MobileBottomNavProps {
  onNewTask?: () => void;
  onNewBatchTask?: () => void;
  onNewExtraordinaryService?: () => void;
}

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition-colors',
    isActive ? 'text-blue-700' : 'text-muted-foreground'
  );

export function MobileBottomNav({
  onNewTask,
  onNewBatchTask,
  onNewExtraordinaryService,
}: MobileBottomNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const hasCreateActions = !!onNewTask || !!onNewBatchTask || !!onNewExtraordinaryService;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-4 items-end gap-1">
        <NavLink to="/" className={navItemClass}>
          <Home className="h-5 w-5" />
          <span>Dashboard</span>
        </NavLink>

        <NavLink to="/calendar" className={navItemClass}>
          <CalendarDays className="h-5 w-5" />
          <span>Calendario</span>
        </NavLink>

        {hasCreateActions ? (
          <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-blue-700">
            <MobileCreateActions
              onNewTask={onNewTask}
              onNewBatchTask={onNewBatchTask}
              onNewExtraordinaryService={onNewExtraordinaryService}
              trigger={
                <Button
                  className="mx-auto -mt-7 flex h-14 w-14 rounded-full shadow-lg"
                  size="icon"
                  aria-label="Crear"
                >
                  <PlusCircle className="h-7 w-7" />
                </Button>
              }
            />
            <span>Crear</span>
          </div>
        ) : (
          <NavLink
            to="/calendar"
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-blue-700"
            aria-label="Ir al calendario para crear"
          >
            <span className="mx-auto -mt-7 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
              <PlusCircle className="h-7 w-7" />
            </span>
            <span>Crear</span>
          </NavLink>
        )}

        <Drawer open={menuOpen} onOpenChange={setMenuOpen}>
          <DrawerTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition-colors',
                pathname !== '/' && pathname !== '/calendar' ? 'text-blue-700' : 'text-muted-foreground'
              )}
            >
              <Menu className="h-5 w-5" />
              <span>Menu</span>
            </button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[88dvh]">
            <DrawerHeader className="pb-2">
              <DrawerTitle>Menu de navegacion</DrawerTitle>
            </DrawerHeader>
            <MobileDashboardSidebar onNavigate={() => setMenuOpen(false)} />
          </DrawerContent>
        </Drawer>
      </div>
    </nav>
  );
}
