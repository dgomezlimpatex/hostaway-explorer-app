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
  Package,
  Truck
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
    title: 'Inventario',
    href: '/inventory',
    icon: Package,
    permission: 'inventory'
  },
  {
    title: 'Logística',
    href: '/logistics/picklists',
    icon: Truck,
    permission: 'logistics'
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
    title: 'Hostaway Sync',
    href: '/hostaway-sync-logs',
    icon: AlertTriangle,
    permission: 'hostaway'
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
      default: return true;
    }
  };

  const filterItemsByPermission = (items: NavigationItem[]) => {
    return items.filter(item => hasPermission(item.permission));
  };

  const renderNavigationSection = (title: string, items: NavigationItem[]) => (
    <div className="mb-6">
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 px-4">
        {title}
      </h3>
      <div className="space-y-1">
        {filterItemsByPermission(items).map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-none transition-all duration-200 border-l-4',
              isActive(item.href)
                ? 'bg-blue-50 text-blue-600 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-transparent'
            )}
          >
            <item.icon className={cn(
              'h-5 w-5',
              isActive(item.href) ? 'text-blue-600' : 'text-gray-400'
            )} />
            {item.title}
          </NavLink>
        ))}
      </div>
    </div>
  );

  return (
    <div className="px-0 py-4 max-h-[70vh] overflow-y-auto">
      {/* Header */}
      <div className="px-4 pb-4 border-b border-gray-100 mb-4">
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

      {/* Navigation Sections */}
      {renderNavigationSection('General', generalItems)}
      {renderNavigationSection('Gestión', managementItems)}
      {renderNavigationSection('Reportes', reportsItems)}
      
      {/* Administración - Solo para admin/manager */}
      {isAdminOrManager() && renderNavigationSection('Administración', adminItems)}
    </div>
  );
};