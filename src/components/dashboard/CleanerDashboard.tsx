
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { UserMenu } from '@/components/auth/UserMenu';
import { ClipboardList } from "lucide-react";

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
                Mis Tareas
              </h1>
              <p className="text-gray-700 mt-1">
                Bienvenida, {userFullName || userEmail}
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
};
