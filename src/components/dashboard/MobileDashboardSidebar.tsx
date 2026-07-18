import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { GlobalSearch } from '@/components/navigation/GlobalSearch';
import {
  AlertTriangle,
  BarChart3,
  Bot,
  Building2,
  Calendar,
  CheckCircle2,
  Home,
  Hotel,
  Layers,
  Link2,
  MapPin,
  Package,
  Receipt,
  Settings,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { useAuth } from '@/hooks/useAuth';
import { isAiAllowedUser } from '@/utils/aiAccess';
import { useIncidentStats } from '@/hooks/useIncidents';

interface NavigationItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  badge?: 'pending-incidents';
}

const generalItems: NavigationItem[] = [
  { title: 'Dashboard', href: '/', icon: Home },
  { title: 'Calendario', href: '/calendar', icon: Calendar, permission: 'calendar' },
  {
    title: 'Incidencias',
    href: '/cleaning-reports?tab=incidents',
    icon: AlertTriangle,
    permission: 'reports',
    badge: 'pending-incidents',
  },
  { title: 'Copiloto IA', href: '/ai-assistant', icon: Bot, permission: 'ai-owner' },
];

const managementItems: NavigationItem[] = [
  { title: 'Trabajadores', href: '/workers', icon: Users, permission: 'workers' },
  { title: 'Clientes', href: '/clients', icon: Building2, permission: 'clients' },
  { title: 'Propiedades', href: '/properties', icon: MapPin, permission: 'properties' },
  {
    title: 'Hermes planificación',
    href: '/planning?copilot=open',
    icon: Bot,
    permission: 'tasks-edit',
  },
  {
    title: 'Edificios',
    href: '/planning/buildings',
    icon: Building2,
    permission: 'tasks-edit',
  },
  { title: 'Lavandería', href: '/lavanderia/gestion', icon: Package, permission: 'reports' },
  { title: 'Inventario', href: '/inventory', icon: Package, permission: 'inventory' },
];

const reportsItems: NavigationItem[] = [
  { title: 'Reportes', href: '/reports', icon: BarChart3, permission: 'reports' },
  {
    title: 'Plantillas de Checklist',
    href: '/checklist-templates',
    icon: CheckCircle2,
    permission: 'admin-only',
  },
];

const billingItems: NavigationItem[] = [
  {
    title: 'Facturación por Cliente',
    href: '/client-billing',
    icon: Receipt,
    permission: 'reports',
  },
];

const syncItems: NavigationItem[] = [
  { title: 'Avantio', href: '/avantio-automation', icon: Settings, permission: 'hostaway' },
  { title: 'Little Hotelier', href: '/little-hotelier', icon: Hotel, permission: 'admin-only' },
  {
    title: 'Avirato Hotel',
    href: '/integraciones/avirato',
    icon: Hotel,
    permission: 'admin-only',
  },
];

const adminItems: NavigationItem[] = [
  { title: 'Gestión de Usuarios', href: '/user-management', icon: UserPlus },
  { title: 'Gestión de Sedes', href: '/sede-management', icon: Building2 },
  { title: 'Portales de clientes', href: '/admin/client-portals', icon: Layers },
  {
    title: 'Tareas Extraordinarias',
    href: '/admin/extraordinary-requests',
    icon: Sparkles,
  },
  {
    title: 'Integraciones · REGISTRO',
    href: '/integraciones',
    icon: Link2,
    permission: 'admin-only',
  },
];

interface MobileDashboardSidebarProps {
  onNavigate: () => void;
}

export const MobileDashboardSidebar = ({ onNavigate }: MobileDashboardSidebarProps) => {
  const location = useLocation();
  const { canAccessModule, hasPermission: hasRolePermission, isAdminOrManager } = useRolePermissions();
  const { user, profile } = useAuth();
  const shouldShowIncidentBadge = isAdminOrManager();
  const { data: incidentStats } = useIncidentStats(shouldShowIncidentBadge);

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
      case 'calendar':
        return canAccessModule('calendar');
      case 'tasks':
        return canAccessModule('tasks');
      case 'tasks-edit': return hasRolePermission('tasks', 'canEdit');
      case 'workers':
        return canAccessModule('workers');
      case 'clients':
        return canAccessModule('clients');
      case 'properties':
        return canAccessModule('properties');
      case 'propertyGroups':
        return canAccessModule('propertyGroups');
      case 'reports':
        return canAccessModule('reports');
      case 'hostaway':
        return canAccessModule('hostaway');
      case 'inventory':
        return canAccessModule('inventory');
      case 'logistics':
        return canAccessModule('logistics');
      case 'admin-only':
        return isAdminOrManager();
      case 'ai-owner':
        return isAiAllowedUser(user, profile);
      default:
        return true;
    }
  };

  const filterItemsByPermission = (items: NavigationItem[]) =>
    items.filter((item) => hasPermission(item.permission));

  const getBadgeCount = (item: NavigationItem) => {
    if (item.badge !== 'pending-incidents') return 0;
    return incidentStats?.pending_limpatex ?? 0;
  };

  const renderNavigationSection = (title: string, items: NavigationItem[]) => (
    <div className="mb-4">
      <h3 className="mb-2 px-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      <div className="space-y-1 px-3">
        {filterItemsByPermission(items).map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
              isActive(item.href)
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
            )}
          >
            <item.icon
              className={cn(
                'h-5 w-5 shrink-0',
                isActive(item.href) ? 'text-blue-600' : 'text-slate-400',
              )}
            />
            <span className="min-w-0 flex-1">{item.title}</span>
            {getBadgeCount(item) > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-none text-white shadow-sm">
                {getBadgeCount(item) > 99 ? '99+' : getBadgeCount(item)}
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-slate-200 px-4 py-4">
        <GlobalSearch />
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        {renderNavigationSection('General', generalItems)}
        {renderNavigationSection('Gestión', managementItems)}
        {renderNavigationSection('Reportes', reportsItems)}
        {renderNavigationSection('Facturación', billingItems)}
        {renderNavigationSection('Sincronizaciones', syncItems)}
        {renderNavigationSection('Administración', adminItems)}
      </div>
    </div>
  );
};

