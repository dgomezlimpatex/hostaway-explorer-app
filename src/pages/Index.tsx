
import { useAuth } from '@/hooks/useAuth';
import { UserMenu } from '@/components/auth/UserMenu';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { HostawayIntegrationWidget } from '@/components/hostaway/HostawayIntegrationWidget';
import StatsCards from "@/components/StatsCards";
import { Calendar, Users, MapPin, BarChart3, ClipboardList, Wrench, Sparkles, TrendingUp } from "lucide-react";

const Index = () => {
  const { user, profile, userRole } = useAuth();

  console.log('Index - auth state:', { user: !!user, profile: !!profile, userRole });

  // Si no hay usuario autenticado, mostrar página de bienvenida
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-800">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative z-10 container mx-auto px-4 py-16">
          <div className="text-center max-w-4xl mx-auto">
            <div className="mb-8">
              <Sparkles className="h-16 w-16 text-yellow-400 mx-auto mb-4 animate-pulse" />
              <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
                Sistema de Gestión de
                <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent"> Limpieza</span>
              </h1>
              <p className="text-xl md:text-2xl text-blue-100 mb-8 leading-relaxed">
                Organiza y gestiona tus servicios de limpieza de manera eficiente con tecnología moderna
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6 mb-12 text-white">
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                <Calendar className="h-8 w-8 text-yellow-400 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Calendario Inteligente</h3>
                <p className="text-sm text-blue-100">Programa y gestiona tareas con facilidad</p>
              </div>
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                <Users className="h-8 w-8 text-green-400 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Gestión de Personal</h3>
                <p className="text-sm text-blue-100">Administra tu equipo de trabajo</p>
              </div>
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                <TrendingUp className="h-8 w-8 text-purple-400 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Reportes Avanzados</h3>
                <p className="text-sm text-blue-100">Análisis y estadísticas detalladas</p>
              </div>
            </div>

            <Link to="/auth">
              <Button size="lg" className="text-lg px-12 py-4 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-black font-semibold rounded-xl shadow-2xl hover:shadow-yellow-500/25 transition-all duration-300 hover:scale-105">
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
  const isCleaner = userRole === 'cleaner';

  // Si es limpiadora, redirigir automáticamente a las tareas
  if (isCleaner) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-lg shadow-lg border-b border-white/20">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                  Mis Tareas
                </h1>
                <p className="text-gray-700 mt-1">
                  Bienvenida, {profile?.full_name || profile?.email || user.email}
                </p>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mt-2">
                  Limpiadora
                </span>
              </div>
              <UserMenu />
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-white rounded-2xl p-12 shadow-xl border border-gray-100">
              <div className="bg-gradient-to-br from-green-100 to-blue-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                <ClipboardList className="h-12 w-12 text-green-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Ver Mis Tareas
              </h2>
              <p className="text-gray-600 mb-8 text-lg">
                Accede a la lista de tareas que tienes asignadas y gestiona tu trabajo diario
              </p>
              <Link to="/tasks">
                <Button size="lg" className="text-lg px-10 py-4 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                  Ver Mis Tareas
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
                Bienvenido, {profile?.full_name || profile?.email || user.email}
              </p>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-2">
                {userRole === 'manager' ? 'Gerente' : userRole === 'supervisor' ? 'Supervisor' : userRole === 'admin' ? 'Administrador' : 'Usuario'}
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
          <Link to="/calendar" className="group transform transition-all duration-300 hover:scale-105">
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-2xl hover:border-blue-200 transition-all duration-300">
              <div className="bg-gradient-to-br from-blue-100 to-indigo-100 w-16 h-16 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Calendar className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Calendario</h3>
              <p className="text-gray-600 leading-relaxed">Ver y gestionar todas las tareas programadas en una vista de calendario interactiva</p>
            </div>
          </Link>

          <Link to="/tasks" className="group transform transition-all duration-300 hover:scale-105">
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-2xl hover:border-green-200 transition-all duration-300">
              <div className="bg-gradient-to-br from-green-100 to-emerald-100 w-16 h-16 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <ClipboardList className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Tareas</h3>
              <p className="text-gray-600 leading-relaxed">Administra y supervisa todas las tareas de limpieza del sistema</p>
            </div>
          </Link>

          {canAccessSupervisor && (
            <Link to="/clients" className="group transform transition-all duration-300 hover:scale-105">
              <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-2xl hover:border-purple-200 transition-all duration-300">
                <div className="bg-gradient-to-br from-purple-100 to-violet-100 w-16 h-16 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Users className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Clientes</h3>
                <p className="text-gray-600 leading-relaxed">Gestiona la información y datos de contacto de todos los clientes</p>
              </div>
            </Link>
          )}

          {canAccessSupervisor && (
            <Link to="/properties" className="group transform transition-all duration-300 hover:scale-105">
              <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-2xl hover:border-orange-200 transition-all duration-300">
                <div className="bg-gradient-to-br from-orange-100 to-amber-100 w-16 h-16 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <MapPin className="h-8 w-8 text-orange-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Propiedades</h3>
                <p className="text-gray-600 leading-relaxed">Administra todas las propiedades y sus características específicas</p>
              </div>
            </Link>
          )}

          {canAccessManager && (
            <Link to="/workers" className="group transform transition-all duration-300 hover:scale-105">
              <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-2xl hover:border-indigo-200 transition-all duration-300">
                <div className="bg-gradient-to-br from-indigo-100 to-blue-100 w-16 h-16 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Wrench className="h-8 w-8 text-indigo-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Trabajadores</h3>
                <p className="text-gray-600 leading-relaxed">Gestiona el equipo de trabajo y asignaciones de personal</p>
              </div>
            </Link>
          )}

          {canAccessSupervisor && (
            <Link to="/reports" className="group transform transition-all duration-300 hover:scale-105">
              <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-2xl hover:border-red-200 transition-all duration-300">
                <div className="bg-gradient-to-br from-red-100 to-pink-100 w-16 h-16 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <BarChart3 className="h-8 w-8 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Reportes</h3>
                <p className="text-gray-600 leading-relaxed">Accede a estadísticas detalladas y análisis de rendimiento</p>
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
