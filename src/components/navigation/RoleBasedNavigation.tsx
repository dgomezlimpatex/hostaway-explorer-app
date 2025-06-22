
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  CheckSquare, 
  Users, 
  Building2, 
  FileText,
  UserCheck,
  Settings,
  BarChart3,
  Home
} from 'lucide-react';
import { useRolePermissions } from '@/hooks/useRolePermissions';

interface NavigationItem {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
  module: string;
  gradientFrom: string;
  gradientTo: string;
}

const ALL_NAVIGATION_ITEMS: NavigationItem[] = [
  {
    title: 'Calendario',
    description: 'Gestiona y visualiza todas las tareas de limpieza',
    icon: Calendar,
    to: '/calendar',
    module: 'calendar',
    gradientFrom: 'from-blue-500',
    gradientTo: 'to-blue-600',
  },
  {
    title: 'Tareas',
    description: 'Lista completa de tareas y gestión avanzada',
    icon: CheckSquare,
    to: '/tasks',
    module: 'tasks',
    gradientFrom: 'from-green-500',
    gradientTo: 'to-green-600',
  },
  {
    title: 'Personal',
    description: 'Gestión del equipo de limpieza',
    icon: UserCheck,
    to: '/workers',
    module: 'workers',
    gradientFrom: 'from-teal-500',
    gradientTo: 'to-teal-600',
  },
  {
    title: 'Clientes',
    description: 'Gestión de clientes y su información',
    icon: Users,
    to: '/clients',
    module: 'clients',
    gradientFrom: 'from-purple-500',
    gradientTo: 'to-purple-600',
  },
  {
    title: 'Propiedades',
    description: 'Administra propiedades y sus características',
    icon: Building2,
    to: '/properties',
    module: 'properties',
    gradientFrom: 'from-orange-500',
    gradientTo: 'to-orange-600',
  },
  {
    title: 'Asignación Automática',
    description: 'Sistema inteligente de asignación de tareas',
    icon: Settings,
    to: '/property-groups',
    module: 'propertyGroups',
    gradientFrom: 'from-indigo-500',
    gradientTo: 'to-indigo-600',
  },
  {
    title: 'Reportes',
    description: 'Análisis y reportes del negocio',
    icon: BarChart3,
    to: '/reports',
    module: 'reports',
    gradientFrom: 'from-pink-500',
    gradientTo: 'to-pink-600',
  },
  {
    title: 'Integración Hostaway',
    description: 'Sincronización y logs de Hostaway',
    icon: FileText,
    to: '/hostaway-sync-logs',
    module: 'hostaway',
    gradientFrom: 'from-gray-500',
    gradientTo: 'to-gray-600',
  }
];

export const RoleBasedNavigation = () => {
  const { canAccessModule, isAdminOrManager, isSupervisor, isCleaner, userRole } = useRolePermissions();

  // Filtrar navegación según el rol
  const availableItems = ALL_NAVIGATION_ITEMS.filter(item => 
    canAccessModule(item.module as any)
  );

  // Descripción específica por rol
  const getRoleDescription = () => {
    if (isAdminOrManager()) {
      return 'Gestiona eficientemente todas las operaciones de limpieza';
    }
    if (isSupervisor()) {
      return 'Supervisa las operaciones diarias del equipo';
    }
    if (isCleaner()) {
      return 'Accede a tus tareas y calendario personal';
    }
    return 'Sistema de gestión de limpieza';
  };

  const getRoleTitle = () => {
    if (isAdminOrManager()) {
      return 'Panel de Administración';
    }
    if (isSupervisor()) {
      return 'Panel de Supervisión';
    }
    if (isCleaner()) {
      return 'Mis Tareas y Calendario';
    }
    return 'Sistema de Gestión';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            {getRoleTitle()}
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            {getRoleDescription()}
          </p>
          <div className="mt-4">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              Rol: {userRole?.charAt(0).toUpperCase()}{userRole?.slice(1)}
            </span>
          </div>
        </div>

        {availableItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {availableItems.map((item) => (
              <Link key={item.to} to={item.to} className="group">
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border border-gray-100 dark:border-slate-700 hover:border-gray-200 dark:hover:border-slate-600">
                  <div className={`bg-gradient-to-r ${item.gradientFrom} ${item.gradientTo} w-16 h-16 rounded-xl flex items-center justify-center mb-4 mx-auto`}>
                    <item.icon className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 text-center">
                    {item.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 text-center text-sm">
                    {item.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Home className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Sin módulos disponibles
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              No tienes permisos para acceder a ningún módulo del sistema.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
