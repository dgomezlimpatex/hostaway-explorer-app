import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Package,
  PackageOpen,
  ArchiveRestore,
  TrendingUp,
  Settings2,
  BarChart3,
  ArrowLeft,
  Home
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRolePermissions, type RolePermissions } from '@/hooks/useRolePermissions';
import { 
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

interface NavigationItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
}

const inventoryItems: NavigationItem[] = [
  {
    title: 'Dashboard',
    href: '/inventory',
    icon: BarChart3,
    permission: 'inventory'
  },
  {
    title: 'Stock',
    href: '/inventory/stock',
    icon: Package,
    permission: 'inventory'
  },
  {
    title: 'Movimientos',
    href: '/inventory/movements',
    icon: ArchiveRestore,
    permission: 'inventory'
  },
  {
    title: 'Configuración',
    href: '/inventory/config',
    icon: Settings2,
    permission: 'inventory'
  },
  {
    title: 'Reportes',
    href: '/inventory/reports',
    icon: TrendingUp,
    permission: 'inventory'
  }
];

function InventorySidebar() {
  const location = useLocation();
  const { canAccessModule } = useRolePermissions();

  const isActive = (href: string) => {
    return location.pathname === href;
  };

  const filterItemsByPermission = (items: NavigationItem[]) => {
    return items.filter(item => {
      if (!item.permission) return true;
      return canAccessModule(item.permission as keyof RolePermissions);
    });
  };

  return (
    <Sidebar className="w-64">
      <SidebarContent>
        {/* Header con botón de vuelta */}
        <div className="p-4 border-b">
          <NavLink 
            to="/" 
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al Dashboard Principal
          </NavLink>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            <PackageOpen className="h-4 w-4" />
            Inventario
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filterItemsByPermission(inventoryItems).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.href}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                        isActive(item.href)
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Botón adicional para ir al dashboard principal */}
        <div className="p-4 border-t mt-auto">
          <NavLink to="/">
            <Button variant="outline" className="w-full justify-start gap-2">
              <Home className="h-4 w-4" />
              Dashboard Principal
            </Button>
          </NavLink>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

interface InventoryLayoutProps {
  children: React.ReactNode;
}

export function InventoryLayout({ children }: InventoryLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <InventorySidebar />
        <main className="flex-1">
          <div className="p-6">
            <div className="mb-6">
              <SidebarTrigger />
            </div>
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}