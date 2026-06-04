import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  ArchiveRestore,
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  Droplets,
  Home,
  Package,
  Settings2,
  Shirt,
} from 'lucide-react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';
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
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { StockWarehouseSelect } from './StockWarehouseSelect';

const stockItems = [
  { title: 'Dashboard', href: '/inventory', icon: BarChart3 },
  { title: 'Stock global', href: '/inventory/stock', icon: Package },
  { title: 'Lavanderia', href: '/inventory/laundry', icon: Shirt },
  { title: 'Amenities', href: '/inventory/amenities', icon: Droplets },
  { title: 'Almacenes', href: '/inventory/warehouses', icon: Building2 },
  { title: 'Movimientos', href: '/inventory/movements', icon: ArchiveRestore },
  { title: 'Configuracion', href: '/inventory/config', icon: Settings2 },
  { title: 'Reportes', href: '/inventory/reports', icon: ClipboardList },
];

function StockSidebar() {
  const location = useLocation();

  return (
    <Sidebar className="w-64">
      <SidebarContent>
        <div className="p-4 border-b">
          <NavLink
            to="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Home className="h-4 w-4" />
            Dashboard principal
          </NavLink>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            <Boxes className="h-4 w-4" />
            Stock profesional
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {stockItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.href}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                        location.pathname === item.href
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
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
      </SidebarContent>
    </Sidebar>
  );
}

interface StockLayoutProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  showWarehouseSelect?: boolean;
}

export function StockLayout({
  title = 'Stock profesional',
  description,
  children,
  actions,
  showWarehouseSelect = true,
}: StockLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full flex-col">
        <AppHeader title="Stock profesional" showSidebarTrigger={true} />
        <div className="flex flex-1">
          <StockSidebar />
          <main className="flex-1 p-4 md:p-6">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
                {description && <p className="text-sm text-muted-foreground">{description}</p>}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {showWarehouseSelect && <StockWarehouseSelect />}
                {actions}
              </div>
            </div>
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
