
import { useAuth } from '@/hooks/useAuth';
import { WelcomePage } from '@/components/dashboard/WelcomePage';
import { CleanerDashboard } from '@/components/dashboard/CleanerDashboard';
import { MainDashboard } from '@/components/dashboard/MainDashboard';

const Index = () => {
  const { user, profile, userRole } = useAuth();

  console.log('Index - auth state:', { user: !!user, profile: !!profile, userRole });

  // Si no hay usuario autenticado, mostrar página de bienvenida
  if (!user) {
    return <WelcomePage />;
  }

  // Configurar permisos correctamente basados en el rol del usuario
  const canAccessManager = userRole === 'manager' || userRole === 'admin';
  const canAccessSupervisor = canAccessManager || userRole === 'supervisor';
  const isCleaner = userRole === 'cleaner';

  // Si es limpiadora, redirigir automáticamente a las tareas
  if (isCleaner) {
    return (
      <CleanerDashboard
        userFullName={profile?.full_name}
        userEmail={profile?.email || user.email}
      />
    );
  }

  return (
    <MainDashboard
      userFullName={profile?.full_name}
      userEmail={profile?.email || user.email}
      userRole={userRole}
      canAccessManager={canAccessManager}
      canAccessSupervisor={canAccessSupervisor}
    />
  );
};

export default Index;
