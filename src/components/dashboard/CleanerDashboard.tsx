
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { UserMenu } from '@/components/auth/UserMenu';
import { ClipboardList, Calendar, User } from "lucide-react";

interface CleanerDashboardProps {
  userFullName?: string | null;
  userEmail?: string | null;
}

export const CleanerDashboard = ({ userFullName, userEmail }: CleanerDashboardProps) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg shadow-lg border-b border-white/20">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                Panel de Trabajador
              </h1>
              <p className="text-gray-700 mt-1">
                Bienvenido/a, {userFullName || userEmail}
              </p>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mt-2">
                <User className="h-3 w-3 mr-1" />
                Limpiador/a
              </span>
            </div>
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Welcome Message */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              ¿Qué deseas hacer hoy?
            </h2>
            <p className="text-gray-600">
              Accede a tus herramientas de trabajo diarias
            </p>
          </div>

          {/* Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tasks Card */}
            <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:scale-105">
              <div className="bg-gradient-to-br from-green-100 to-green-200 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <ClipboardList className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3 text-center">
                Mis Tareas
              </h3>
              <p className="text-gray-600 mb-6 text-center">
                Consulta las tareas que tienes asignadas, actualiza su estado y reporta cualquier incidencia
              </p>
              <Link to="/tasks" className="block">
                <Button size="lg" className="w-full text-lg py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300">
                  Ver Mis Tareas
                </Button>
              </Link>
            </div>

            {/* Calendar Card */}
            <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:scale-105">
              <div className="bg-gradient-to-br from-blue-100 to-blue-200 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Calendar className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3 text-center">
                Mi Calendario
              </h3>
              <p className="text-gray-600 mb-6 text-center">
                Visualiza tu horario personal, planifica tu día y consulta las fechas importantes
              </p>
              <Link to="/calendar" className="block">
                <Button size="lg" variant="outline" className="w-full text-lg py-3 border-2 border-blue-500 text-blue-600 hover:bg-blue-50 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300">
                  Ver Mi Calendario
                </Button>
              </Link>
            </div>
          </div>

          {/* Quick Stats or Tips */}
          <div className="mt-8 bg-gradient-to-r from-blue-500 to-green-500 rounded-2xl p-6 text-white">
            <div className="text-center">
              <h4 className="text-lg font-semibold mb-2">💡 Recordatorio</h4>
              <p className="text-blue-100">
                Recuerda actualizar el estado de tus tareas una vez completadas y reportar cualquier problema encontrado durante la limpieza.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
