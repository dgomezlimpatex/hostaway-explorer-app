import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { GlobalSearch } from '@/components/navigation/GlobalSearch';
import { 
  Calendar, 
  Users, 
  MapPin, 
  BarChart3,
  UserPlus,
  Layers,
  Building2,
  Home,
  AlertTriangle,
  CheckCircle2,
  Package,
  Receipt,
  Settings,
  Link2,
  Sparkles,
  Hotel
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRolePermissions } from '@/hooks/useRolePermissions';

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
    title: 'Lavandería',
    href: '/lavanderia/gestion',
    icon: Package,
    permission: 'reports'
  },
  {
    title: 'Inventario',
    href: '/inventory',
    icon: Package,
    permission: 'inventory'
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

interface MobileDashboardSidebarProps {
  onNavigate: () => void;
}

export const MobileDashboardSidebar = ({ onNavigate }: MobileDashboardSidebarProps) => {
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
      case 'admin-only': return isAdminOrManager();
      default: return true;
    }
  };

  const filterItemsByPermission = (items: NavigationItem[]) => {
    return items.filter(item => hasPermission(item.permission));
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
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            )}
          >
            <item.icon className={cn(
              'h-5 w-5 shrink-0',
              isActive(item.href) ? 'text-blue-600' : 'text-slate-400'
            )} />
            {item.title}
          </NavLink>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-h-[72dvh] overflow-y-auto px-0 pb-6 pt-2">
      {/* Header */}
      <div className="mb-4 border-b border-slate-100 px-4 pb-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600">
            <span className="text-white text-sm font-medium">A</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-950">Panel de Control</p>
            <p className="text-xs text-gray-500">Gestión de limpieza</p>
          </div>
        </div>
        <GlobalSearch />
      </div>

      {/* Navigation Sections */}
      {renderNavigationSection('General', generalItems)}
      {renderNavigationSection('Gestión', managementItems)}
      {renderNavigationSection('Reportes', reportsItems)}
      {renderNavigationSection('Facturación', billingItems)}
      {isAdminOrManager() && renderNavigationSection('Sincronizaciones', syncItems)}
      
      {/* Administración - Solo para admin/manager */}
      {isAdminOrManager() && renderNavigationSection('Administración', adminItems)}
    </div>
  );
};
