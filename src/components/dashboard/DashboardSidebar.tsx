import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Calendar, 
  ClipboardList, 
  Users, 
  MapPin, 
  BarChart3,
  UserPlus,
  Layers,
  FileText,
  Building2,
  Settings,
  Home,
  AlertTriangle,
  CheckCircle2,
  Package,
  PackageOpen,
  ArchiveRestore,
  TrendingUp,
  Settings2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { 
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

interface NavigationItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
}

const generalItems: NavigationItem[] = [
  {
    title: 'Dashboard',
    href: '/',
    icon: Home,
  },
  {
    title: 'Calendario',
    href: '/calendar',
    icon: Calendar,
    permission: 'calendar'
  },
  {
    title: 'Tareas',
    href: '/tasks',
    icon: ClipboardList,
    permission: 'tasks'
  },
];

const managementItems: NavigationItem[] = [
  {
    title: 'Trabajadores',
    href: '/workers',
    icon: Users,
    permission: 'workers'
  },
  {
    title: 'Clientes',
    href: '/clients',
    icon: Building2,
    permission: 'clients'
  },
  {
    title: 'Propiedades',
    href: '/properties',
    icon: MapPin,
    permission: 'properties'
  },
  {
    title: 'Grupos de Propiedades',
    href: '/property-groups',
    icon: Layers,
    permission: 'propertyGroups'
  },
];

const reportsItems: NavigationItem[] = [
  {
    title: 'Reportes',
    href: '/reports',
    icon: BarChart3,
    permission: 'reports'
  },
  {
    title: 'Dashboard de Reportes',
    href: '/cleaning-reports',
    icon: FileText,
    permission: 'reports'
  },
  {
    title: 'Plantillas de Checklist',
    href: '/checklist-templates',
    icon: CheckCircle2,
    permission: 'tasks'
  },
];

const inventoryItems: NavigationItem[] = [
  {
    title: 'Dashboard de Inventario',
    href: '/inventory',
    icon: Package,
    permission: 'inventory'
  },
  {
    title: 'Stock Actual',
    href: '/inventory/stock',
    icon: PackageOpen,
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
    title: 'Reportes de Inventario',
    href: '/inventory/reports',
    icon: TrendingUp,
    permission: 'inventory'
  },
];

const adminItems: NavigationItem[] = [
  {
    title: 'Gestión de Usuarios',
    href: '/user-management',
    icon: UserPlus,
  },
  {
    title: 'Hostaway Sync',
    href: '/hostaway-sync-logs',
    icon: AlertTriangle,
    permission: 'hostaway'
  },
];

export const DashboardSidebar = () => {
  const location = useLocation();
  const { canAccessModule, isAdminOrManager } = useRolePermissions();

  const isActive = (href: string) => {
    if (href === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(href);
  };

  const hasPermission = (permission?: string) => {
    if (!permission) return true;
    // Mapeo manual para evitar problemas de tipos
    switch (permission) {
      case 'calendar': return canAccessModule('calendar');
      case 'tasks': return canAccessModule('tasks');
      case 'workers': return canAccessModule('workers');
      case 'clients': return canAccessModule('clients');
      case 'properties': return canAccessModule('properties');
      case 'propertyGroups': return canAccessModule('propertyGroups');
      case 'reports': return canAccessModule('reports');
      case 'hostaway': return canAccessModule('hostaway');
      case 'inventory': return canAccessModule('inventory');
      default: return true;
    }
  };

  const filterItemsByPermission = (items: NavigationItem[]) => {
    return items.filter(item => hasPermission(item.permission));
  };

  return (
    <Sidebar className="border-r border-gray-200 bg-white">
      <SidebarContent className="bg-white">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Panel de Control</h2>
          <p className="text-sm text-gray-500 mt-1">Gestión de limpieza</p>
        </div>

        {/* General */}
        <SidebarGroup>
          <SidebarGroupLabel className="px-6 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
            General
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="px-3">
              {filterItemsByPermission(generalItems).map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200',
                        isActive(item.href)
                          ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      )}
                    >
                      <item.icon className={cn(
                        'h-5 w-5',
                        isActive(item.href) ? 'text-blue-600' : 'text-gray-400'
                      )} />
                      {item.title}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Gestión */}
        <SidebarGroup>
          <SidebarGroupLabel className="px-6 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
            Gestión
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="px-3">
              {filterItemsByPermission(managementItems).map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200',
                        isActive(item.href)
                          ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      )}
                    >
                      <item.icon className={cn(
                        'h-5 w-5',
                        isActive(item.href) ? 'text-blue-600' : 'text-gray-400'
                      )} />
                      {item.title}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Reportes */}
        <SidebarGroup>
          <SidebarGroupLabel className="px-6 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
            Reportes
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="px-3">
              {filterItemsByPermission(reportsItems).map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200',
                        isActive(item.href)
                          ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      )}
                    >
                      <item.icon className={cn(
                        'h-5 w-5',
                        isActive(item.href) ? 'text-blue-600' : 'text-gray-400'
                      )} />
                      {item.title}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Inventario */}
        {canAccessModule('inventory') && (
          <SidebarGroup>
            <SidebarGroupLabel className="px-6 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Inventario
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="px-3">
                {filterItemsByPermission(inventoryItems).map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.href}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200',
                          isActive(item.href)
                            ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        )}
                      >
                        <item.icon className={cn(
                          'h-5 w-5',
                          isActive(item.href) ? 'text-blue-600' : 'text-gray-400'
                        )} />
                        {item.title}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Administración - Solo para admin/manager */}
        {isAdminOrManager() && (
          <SidebarGroup>
            <SidebarGroupLabel className="px-6 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Administración
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="px-3">
                {filterItemsByPermission(adminItems).map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.href}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200',
                          isActive(item.href)
                            ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        )}
                      >
                        <item.icon className={cn(
                          'h-5 w-5',
                          isActive(item.href) ? 'text-blue-600' : 'text-gray-400'
                        )} />
                        {item.title}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Footer */}
        <div className="mt-auto p-6 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">A</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">Admin</p>
              <p className="text-xs text-gray-500 truncate">Sistema de gestión</p>
            </div>
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
};