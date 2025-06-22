
import { NavigationCard } from '@/components/dashboard/NavigationCard';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { 
  Calendar, 
  ClipboardList, 
  Users, 
  MapPin, 
  BarChart3, 
  Settings,
  UserPlus,
  Layers
} from 'lucide-react';

export const RoleBasedNavigation = () => {
  const { canAccessModule, isAdminOrManager } = useRolePermissions();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Panel de Control
          </h1>
          <p className="text-xl text-gray-600">
            Selecciona la sección a la que deseas acceder
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {canAccessModule('calendar') && (
            <NavigationCard
              to="/calendar"
              title="Calendario"
              description="Visualiza y gestiona las tareas programadas en el calendario"
              icon={Calendar}
              gradientFrom="bg-gradient-to-br from-blue-500"
              gradientTo="to-blue-600"
              iconColor="text-white"
              hoverBorderColor="hover:border-blue-300"
            />
          )}

          {canAccessModule('tasks') && (
            <NavigationCard
              to="/tasks"
              title="Tareas"
              description="Administra todas las tareas de limpieza y su estado"
              icon={ClipboardList}
              gradientFrom="bg-gradient-to-br from-green-500"
              gradientTo="to-green-600"
              iconColor="text-white"
              hoverBorderColor="hover:border-green-300"
            />
          )}

          {canAccessModule('workers') && (
            <NavigationCard
              to="/workers"
              title="Trabajadores"
              description="Gestiona el equipo de limpieza y su disponibilidad"
              icon={Users}
              gradientFrom="bg-gradient-to-br from-purple-500"
              gradientTo="to-purple-600"
              iconColor="text-white"
              hoverBorderColor="hover:border-purple-300"
            />
          )}

          {canAccessModule('clients') && (
            <NavigationCard
              to="/clients"
              title="Clientes"
              description="Administra la información de tus clientes"
              icon={Users}
              gradientFrom="bg-gradient-to-br from-orange-500"
              gradientTo="to-orange-600"
              iconColor="text-white"
              hoverBorderColor="hover:border-orange-300"
            />
          )}

          {canAccessModule('properties') && (
            <NavigationCard
              to="/properties"
              title="Propiedades"
              description="Gestiona las propiedades y sus características"
              icon={MapPin}
              gradientFrom="bg-gradient-to-br from-red-500"
              gradientTo="to-red-600"
              iconColor="text-white"
              hoverBorderColor="hover:border-red-300"
            />
          )}

          {canAccessModule('propertyGroups') && (
            <NavigationCard
              to="/property-groups"
              title="Grupos de Propiedades"
              description="Organiza propiedades en grupos para mejor gestión"
              icon={Layers}
              gradientFrom="bg-gradient-to-br from-teal-500"
              gradientTo="to-teal-600"
              iconColor="text-white"
              hoverBorderColor="hover:border-teal-300"
            />
          )}

          {canAccessModule('reports') && (
            <NavigationCard
              to="/reports"
              title="Reportes"
              description="Visualiza estadísticas y reportes del negocio"
              icon={BarChart3}
              gradientFrom="bg-gradient-to-br from-indigo-500"
              gradientTo="to-indigo-600"
              iconColor="text-white"
              hoverBorderColor="hover:border-indigo-300"
            />
          )}

          {canAccessModule('hostaway') && (
            <NavigationCard
              to="/hostaway-sync-logs"
              title="Hostaway Sync"
              description="Revisa los logs de sincronización con Hostaway"
              icon={Settings}
              gradientFrom="bg-gradient-to-br from-gray-500"
              gradientTo="to-gray-600"
              iconColor="text-white"
              hoverBorderColor="hover:border-gray-300"
            />
          )}

          {/* Nueva sección para gestión de usuarios - solo para admin/manager */}
          {isAdminOrManager() && (
            <NavigationCard
              to="/user-management"
              title="Gestión de Usuarios"
              description="Invita nuevos usuarios y gestiona el acceso al sistema"
              icon={UserPlus}
              gradientFrom="bg-gradient-to-br from-emerald-500"
              gradientTo="to-emerald-600"
              iconColor="text-white"
              hoverBorderColor="hover:border-emerald-300"
            />
          )}
        </div>
      </div>
    </div>
  );
};
