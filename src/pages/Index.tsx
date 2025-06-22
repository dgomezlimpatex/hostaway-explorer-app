
import { useAuth } from '@/hooks/useAuth';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { WelcomePage } from '@/components/dashboard/WelcomePage';
import { CleanerDashboard } from '@/components/dashboard/CleanerDashboard';
import { MainDashboard } from '@/components/dashboard/MainDashboard';

const Index = () => {
  const { user, profile } = useAuth();
  const { isCleaner } = useRolePermissions();

  console.log('Index - auth state:', { user: !!user, profile: !!profile });

  // Si no hay usuario autenticado, mostrar página de bienvenida
  if (!user) {
    return <WelcomePage />;
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
