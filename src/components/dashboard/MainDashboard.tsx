
import { UserMenu } from '@/components/auth/UserMenu';
import { HostawayIntegrationWidget } from '@/components/hostaway/HostawayIntegrationWidget';
import StatsCards from "@/components/StatsCards";
import { NavigationCard } from './NavigationCard';
import { Calendar, Users, MapPin, BarChart3, ClipboardList, Wrench } from "lucide-react";

interface MainDashboardProps {
  userFullName?: string | null;
  userEmail?: string | null;
  userRole: string | null;
  canAccessManager: boolean;
  canAccessSupervisor: boolean;
}

export const MainDashboard = ({
  userFullName,
  userEmail,
  userRole,
  canAccessManager,
  canAccessSupervisor
}: MainDashboardProps) => {
  const getRoleLabel = (role: string | null) => {
    switch (role) {
      case 'manager': return 'Gerente';
      case 'supervisor': return 'Supervisor';
      case 'admin': return 'Administrador';
      default: return 'Usuario';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg shadow-lg border-b border-white/20 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Sistema de Limpieza
              </h1>
              <p className="text-gray-700 mt-1">
                Bienvenido, {userFullName || userEmail}
              </p>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-2">
                {getRoleLabel(userRole)}
              </span>
            </div>
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="mb-12">
          <StatsCards />
        </div>

        {/* Hostaway Integration Widget */}
        <div className="mb-12">
          <HostawayIntegrationWidget />
        </div>

        {/* Navigation Cards */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Panel de Control</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <NavigationCard
            to="/calendar"
            title="Calendario"
            description="Ver y gestionar todas las tareas programadas en una vista de calendario interactiva"
            icon={Calendar}
            gradientFrom="bg-gradient-to-br from-blue-100"
            gradientTo="to-indigo-100"
            iconColor="text-blue-600"
            hoverBorderColor="hover:border-blue-200"
          />

          <NavigationCard
            to="/tasks"
            title="Tareas"
            description="Administra y supervisa todas las tareas de limpieza del sistema"
            icon={ClipboardList}
            gradientFrom="bg-gradient-to-br from-green-100"
            gradientTo="to-emerald-100"
            iconColor="text-green-600"
            hoverBorderColor="hover:border-green-200"
          />

          {canAccessSupervisor && (
            <NavigationCard
              to="/clients"
              title="Clientes"
              description="Gestiona la información y datos de contacto de todos los clientes"
              icon={Users}
              gradientFrom="bg-gradient-to-br from-purple-100"
              gradientTo="to-violet-100"
              iconColor="text-purple-600"
              hoverBorderColor="hover:border-purple-200"
            />
          )}

          {canAccessSupervisor && (
            <NavigationCard
              to="/properties"
              title="Propiedades"
              description="Administra todas las propiedades y sus características específicas"
              icon={MapPin}
              gradientFrom="bg-gradient-to-br from-orange-100"
              gradientTo="to-amber-100"
              iconColor="text-orange-600"
              hoverBorderColor="hover:border-orange-200"
            />
          )}

          {canAccessManager && (
            <NavigationCard
              to="/workers"
              title="Trabajadores"
              description="Gestiona el equipo de trabajo y asignaciones de personal"
              icon={Wrench}
              gradientFrom="bg-gradient-to-br from-indigo-100"
              gradientTo="to-blue-100"
              iconColor="text-indigo-600"
              hoverBorderColor="hover:border-indigo-200"
            />
          )}

          {canAccessSupervisor && (
            <NavigationCard
              to="/reports"
              title="Reportes"
              description="Accede a estadísticas detalladas y análisis de rendimiento"
              icon={BarChart3}
              gradientFrom="bg-gradient-to-br from-red-100"
              gradientTo="to-pink-100"
              iconColor="text-red-600"
              hoverBorderColor="hover:border-red-200"
            />
          )}
        </div>
      </div>
    </div>
  );
};
