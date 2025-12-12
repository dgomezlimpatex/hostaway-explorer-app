
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
  Home,
  AlertTriangle,
  CheckCircle2,
  LogOut,
  Shirt,
  Bed
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
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
  {
    title: 'Control de Mudas',
    href: '/control-mudas',
    icon: Bed,
    permission: 'reports'
  },
  {
    title: 'Lavandería',
    href: '/lavanderia/gestion',
    icon: Shirt,
    permission: 'reports'
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

const adminItems: NavigationItem[] = [
  {
    title: 'Gestión de Usuarios',
    href: '/user-management',
    icon: UserPlus,
  },
  {
    title: 'Gestión de Sedes',
    href: '/sede-management',
    icon: Building2,
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
  const { state } = useSidebar();
  const { signOut, profile } = useAuth();

  const isCollapsed = state === 'collapsed';

  const isActive = (href: string) => {
    if (href === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(href);
  };

  const hasPermission = (permission?: string) => {
    if (!permission) return true;
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
      case 'logistics': return canAccessModule('logistics');
      default: return true;
    }
  };

  const filterItemsByPermission = (items: NavigationItem[]) => {
    return items.filter(item => hasPermission(item.permission));
  };

  const renderNavigationSection = (title: string, items: NavigationItem[]) => {
    const filteredItems = filterItemsByPermission(items);
    if (filteredItems.length === 0) return null;

    return (
      <SidebarGroup>
        <SidebarGroupLabel className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          {title}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {filteredItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild>
                  <NavLink
                    to={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200',
                      isActive(item.href)
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )}
                  >
                    <item.icon className={cn(
                      'h-5 w-5',
                      isActive(item.href) ? 'text-blue-600' : 'text-gray-400'
                    )} />
                    {!isCollapsed && <span>{item.title}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar className={isCollapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarContent className="flex flex-col h-full">
        {/* Header */}
        {!isCollapsed && (
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">A</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Panel de Control</p>
                <p className="text-xs text-gray-500">Gestión de limpieza</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto py-4 space-y-2">
          {renderNavigationSection('General', generalItems)}
          {renderNavigationSection('Gestión', managementItems)}
          {renderNavigationSection('Reportes', reportsItems)}
          
          {/* Administración - Solo para admin/manager */}
          {isAdminOrManager() && renderNavigationSection('Administración', adminItems)}
        </div>
      </SidebarContent>

      {/* Footer with Logout Button */}
      <SidebarFooter className="border-t border-gray-100 p-4">
        {!isCollapsed && profile && (
          <div className="mb-3">
            <p className="text-xs text-gray-500 truncate">{profile.full_name || 'Usuario'}</p>
            <p className="text-xs text-gray-400 truncate">{profile.email}</p>
          </div>
        )}
        <Button
          variant="ghost"
          size={isCollapsed ? "icon" : "sm"}
          onClick={signOut}
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span className="ml-2">Cerrar sesión</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
};
