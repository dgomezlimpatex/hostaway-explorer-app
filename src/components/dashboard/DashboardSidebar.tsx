
import React from 'react';
import { GlobalSearch } from '@/components/navigation/GlobalSearch';
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
  Bed,
  Receipt,
  TrendingUp,
  Search,
  RefreshCw,
  Settings,
  Link2,
  Sparkles,
  Hotel,
  ChevronRight,
  Package,
  Bot,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { isAiAllowedUser } from '@/utils/aiAccess';
import { useIncidentStats } from '@/hooks/useIncidents';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar';

interface NavigationItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  badge?: 'pending-incidents';
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
    title: 'Incidencias',
    href: '/cleaning-reports?tab=incidents',
    icon: AlertTriangle,
    permission: 'reports',
    badge: 'pending-incidents',
  },
  {
    title: 'Copiloto IA',
    href: '/ai-assistant',
    icon: Bot,
    permission: 'ai-owner'
  },
];

const managementItems: NavigationItem[] = [
  {
    title: 'Planificación limpiezas',
    href: '/cleaning-planning',
    icon: ClipboardList,
    permission: 'tasks-edit'
  },
  {
    title: 'Hermes planificación',
    href: '/cleaning-planning?copilot=open',
    icon: Bot,
    permission: 'tasks-edit'
  },
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
  {
    title: 'Inventario',
    href: '/inventory',
    icon: Package,
    permission: 'inventory'
  },
  {
    title: 'Tareas Recurrentes',
    href: '/recurring-tasks',
    icon: RefreshCw,
    permission: 'admin-only'
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
    title: 'Previsión de personal',
    href: '/forecast',
    icon: TrendingUp,
    permission: 'workers'
  },
  {
    title: 'Alertas de previsión',
    href: '/forecast/settings',
    icon: AlertTriangle,
    permission: 'workers'
  },
  {
    title: 'Plantillas de Checklist',
    href: '/checklist-templates',
    icon: CheckCircle2,
    permission: 'admin-only'
  },
];

const billingItems: NavigationItem[] = [
  {
    title: 'Facturación por Cliente',
    href: '/client-billing',
    icon: Receipt,
    permission: 'reports'
  },
];

const syncItems: NavigationItem[] = [
  {
    title: 'Avantio',
    href: '/avantio-automation',
    icon: Settings,
    permission: 'hostaway'
  },
  {
    title: 'Little Hotelier',
    href: '/little-hotelier',
    icon: Hotel,
    permission: 'admin-only'
  },
  {
    title: 'Avirato Hotel',
    href: '/integraciones/avirato',
    icon: Hotel,
    permission: 'admin-only'
  },
  {
    title: 'Hostaway Sync',
    href: '/hostaway-sync-logs',
    icon: AlertTriangle,
    permission: 'hostaway'
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
    title: 'Portales de clientes',
    href: '/admin/client-portals',
    icon: Layers,
  },
  {
    title: 'Tareas Extraordinarias',
    href: '/admin/extraordinary-requests',
    icon: Sparkles,
  },
  {
    title: 'Integraciones · REGISTRO',
    href: '/integraciones',
    icon: Link2,
    permission: 'admin-only'
  },
];

export const DashboardSidebar = () => {
  const location = useLocation();
  const { canAccessModule, hasPermission: hasRolePermission, isAdminOrManager } = useRolePermissions();
  const { state } = useSidebar();
  const { signOut, profile, user } = useAuth();
  const shouldShowIncidentBadge = isAdminOrManager();
  const { data: incidentStats } = useIncidentStats(shouldShowIncidentBadge);

  const isCollapsed = state === 'collapsed';

  const isActive = (href: string) => {
    const path = href.split('?')[0];
    if (href === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const hasPermission = (permission?: string) => {
    if (!permission) return true;
    switch (permission) {
      case 'calendar': return canAccessModule('calendar');
      case 'tasks': return canAccessModule('tasks');
      case 'tasks-edit': return hasRolePermission('tasks', 'canEdit');
      case 'workers': return canAccessModule('workers');
      case 'clients': return canAccessModule('clients');
      case 'properties': return canAccessModule('properties');
      case 'propertyGroups': return canAccessModule('propertyGroups');
      case 'reports': return canAccessModule('reports');
      case 'hostaway': return canAccessModule('hostaway');
      case 'inventory': return canAccessModule('inventory');
      case 'logistics': return canAccessModule('logistics');
      case 'admin-only': return isAdminOrManager();
      case 'ai-owner': return isAiAllowedUser(user, profile);
      default: return true;
    }
  };

  const filterItemsByPermission = (items: NavigationItem[]) => {
    return items.filter(item => hasPermission(item.permission));
  };

  const getBadgeCount = (item: NavigationItem) => {
    if (item.badge !== 'pending-incidents') return 0;
    return incidentStats?.pending_limpatex ?? 0;
  };

  const renderNavigationSection = (title: string, items: NavigationItem[]) => {
    const filteredItems = filterItemsByPermission(items);
    if (filteredItems.length === 0) return null;

    return (
      <SidebarGroup>
        <SidebarGroupLabel className="px-3 text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
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
                      'relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-all duration-200',
                      isActive(item.href)
                        ? 'bg-white text-[#310984] shadow-lg shadow-black/10'
                        : 'text-white/72 hover:bg-white/10 hover:text-white'
                    )}
                  >
                    <item.icon className={cn(
                      'h-5 w-5',
                      isActive(item.href) ? 'text-[#310984]' : 'text-white/48'
                    )} />
                    {!isCollapsed && <span>{item.title}</span>}
                    {getBadgeCount(item) > 0 && (
                      <span
                        className={cn(
                          'ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-none text-white shadow-sm',
                          isCollapsed && 'absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[10px]'
                        )}
                      >
                        {getBadgeCount(item) > 99 ? '99+' : getBadgeCount(item)}
                      </span>
                    )}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  const renderSyncSection = (title: string, items: NavigationItem[]) => {
    const filteredItems = filterItemsByPermission(items);
    if (filteredItems.length === 0) return null;

    const isAnyActive = filteredItems.some(item => isActive(item.href));

    return (
      <SidebarGroup>
        <SidebarGroupLabel className="px-3 text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
          {title}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <Collapsible defaultOpen={isAnyActive} className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton>
                    <RefreshCw className="h-5 w-5 text-gray-400" />
                    {!isCollapsed && <span>Sincronizaciones</span>}
                    {!isCollapsed && (
                      <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90 h-4 w-4 text-gray-400" />
                    )}
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {filteredItems.map((item) => (
                      <SidebarMenuSubItem key={item.href}>
                        <SidebarMenuSubButton asChild isActive={isActive(item.href)}>
                          <NavLink to={item.href}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </NavLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar className={cn('border-r border-white/10 bg-[#160329] text-white shadow-[24px_0_80px_rgba(49,9,132,0.25)]', isCollapsed ? 'w-16' : 'w-72')} collapsible="icon">
      <SidebarContent className="flex h-full flex-col bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_18rem)]">
        {/* Header */}
        {!isCollapsed && (
          <div className="border-b border-white/10 p-4">
            <div className="rounded-3xl border border-white/10 bg-white/8 p-3 shadow-2xl shadow-black/10 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#d9ccff] via-white to-cyan-200 text-lg font-black text-[#310984] shadow-lg shadow-cyan-950/20">
                  L
                </div>
                <div>
                  <p className="text-sm font-black text-white">Limpatex OS</p>
                  <p className="text-xs font-medium text-white/55">Operativa hospitality</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Global Search */}
        <div className="px-3 pt-3">
          {isCollapsed ? (
            <GlobalSearch
              trigger={
                <button
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10 transition-colors hover:bg-white/15"
                  onClick={() => {}}
                >
                  <Search className="h-4 w-4 text-white/65" />
                </button>
              }
            />
          ) : (
            <GlobalSearch />
          )}
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto py-4 space-y-2">
          {renderNavigationSection('General', generalItems)}
          {renderNavigationSection('Gestión', managementItems)}
          {renderNavigationSection('Reportes', reportsItems)}
          {renderNavigationSection('Facturación', billingItems)}
          {isAdminOrManager() && renderSyncSection('Sincronizaciones', syncItems)}
          {/* Administración - Solo para admin/manager */}
          {isAdminOrManager() && renderNavigationSection('Administración', adminItems)}
        </div>
      </SidebarContent>

      {/* Footer with Logout Button */}
      <SidebarFooter className="border-t border-white/10 p-4">
        {!isCollapsed && profile && (
          <div className="mb-3 rounded-2xl border border-white/10 bg-white/8 p-3">
            <p className="truncate text-xs font-semibold text-white/80">{profile.full_name || 'Usuario'}</p>
            <p className="truncate text-xs text-white/45">{profile.email}</p>
          </div>
        )}
        <Button
          variant="ghost"
          size={isCollapsed ? "icon" : "sm"}
          onClick={signOut}
          className="w-full justify-start rounded-2xl text-rose-100 hover:bg-rose-500/15 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span className="ml-2">Cerrar sesión</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
};
