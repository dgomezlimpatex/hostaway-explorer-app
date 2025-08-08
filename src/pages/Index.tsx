
import { useAuth } from '@/hooks/useAuth';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { WelcomePage } from '@/components/dashboard/WelcomePage';
import { CleanerDashboard } from '@/components/dashboard/CleanerDashboard';
import { MainDashboard } from '@/components/dashboard/MainDashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserX, Clock } from 'lucide-react';

const Index = () => {
  const { user, profile, userRole, isLoading } = useAuth();
  const { isCleaner } = useRolePermissions();

  console.log('Index - auth state:', { user: !!user, profile: !!profile, userRole, isLoading });

  // Si no hay usuario autenticado, mostrar página de bienvenida
  if (!user) {
    return <WelcomePage />;
  }

  // Si está cargando, mostrar spinner de carga
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>Cargando...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Si el usuario no tiene rol asignado, mostrar mensaje de espera
  if (!userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Clock className="h-12 w-12 text-orange-500 mx-auto mb-4" />
            <CardTitle>Cuenta Pendiente de Activación</CardTitle>
            <CardDescription>
              Tu cuenta ha sido creada pero aún no ha sido activada por un administrador.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-gray-600 mb-4">
              Por favor, contacta con tu administrador para que active tu cuenta y te asigne los permisos correspondientes.
            </p>
            <p className="text-xs text-gray-500">
              Usuario: {profile?.email || user.email}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Si es limpiadora, mostrar dashboard específico
  if (isCleaner()) {
    return (
      <CleanerDashboard
        userFullName={profile?.full_name}
        userEmail={profile?.email || user.email}
      />
    );
  }

  // Para admin, manager y supervisor: mostrar dashboard principal con navegación basada en roles
  return <MainDashboard />;
};

export default Index;
