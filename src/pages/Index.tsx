
import { useAuth } from '@/hooks/useAuth';
import { UserMenu } from '@/components/auth/UserMenu';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { HostawayIntegrationWidget } from '@/components/hostaway/HostawayIntegrationWidget';
import StatsCards from "@/components/StatsCards";
import { Calendar, Users, MapPin, BarChart3, ClipboardList, Wrench } from "lucide-react";

const Index = () => {
  const { user, profile, userRole } = useAuth();

  console.log('Index - auth state:', { user: !!user, profile: !!profile, userRole });

  // Si no hay usuario autenticado, mostrar página de bienvenida
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Sistema de Gestión de Limpieza
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Organiza y gestiona tus servicios de limpieza de manera eficiente
            </p>
            <Link to="/auth">
              <Button size="lg" className="text-lg px-8 py-3">
                Iniciar Sesión
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Configurar permisos correctamente basados en el rol del usuario
  const canAccessManager = userRole === 'manager' || userRole === 'admin';
  const canAccessSupervisor = canAccessManager || userRole === 'supervisor';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Sistema de Limpieza
              </h1>
              <p className="text-gray-600">
                Bienvenido, {profile?.full_name || profile?.email || user.email}
              </p>
              <p className="text-sm text-gray-500">
                Rol: {userRole || 'Cargando...'}
              </p>
            </div>
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="mb-8">
          <StatsCards />
        </div>

        {/* Hostaway Integration Widget */}
        <div className="mb-8">
          <HostawayIntegrationWidget />
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link to="/calendar" className="group">
            <div className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-3">
                <Calendar className="h-8 w-8 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">Calendario</h3>
                  <p className="text-sm text-gray-600">Ver tareas programadas</p>
                </div>
              </div>
            </div>
          </Link>

          <Link to="/tasks" className="group">
            <div className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-3">
                <ClipboardList className="h-8 w-8 text-green-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">Tareas</h3>
                  <p className="text-sm text-gray-600">Gestionar tareas</p>
                </div>
              </div>
            </div>
          </Link>

          {canAccessSupervisor && (
            <Link to="/clients" className="group">
              <div className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                <div className="flex items-center space-x-3">
                  <Users className="h-8 w-8 text-purple-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Clientes</h3>
                    <p className="text-sm text-gray-600">Administrar clientes</p>
                  </div>
                </div>
              </div>
            </Link>
          )}

          {canAccessSupervisor && (
            <Link to="/properties" className="group">
              <div className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                <div className="flex items-center space-x-3">
                  <MapPin className="h-8 w-8 text-orange-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Propiedades</h3>
                    <p className="text-sm text-gray-600">Gestionar propiedades</p>
                  </div>
                </div>
              </div>
            </Link>
          )}

          {canAccessManager && (
            <Link to="/workers" className="group">
              <div className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                <div className="flex items-center space-x-3">
                  <Wrench className="h-8 w-8 text-indigo-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Trabajadores</h3>
                    <p className="text-sm text-gray-600">Administrar personal</p>
                  </div>
                </div>
              </div>
            </Link>
          )}

          {canAccessSupervisor && (
            <Link to="/reports" className="group">
              <div className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                <div className="flex items-center space-x-3">
                  <BarChart3 className="h-8 w-8 text-red-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Reportes</h3>
                    <p className="text-sm text-gray-600">Ver estadísticas</p>
                  </div>
                </div>
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
