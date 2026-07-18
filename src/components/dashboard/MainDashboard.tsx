
import { RoleBasedNavigation } from '@/components/navigation/RoleBasedNavigation';
import { ManagerDashboard } from './ManagerDashboard';
import { useRolePermissions } from '@/hooks/useRolePermissions';

export const MainDashboard = () => {
  const { isAdminOrManager } = useRolePermissions();

  // Si es admin o manager, mostrar el nuevo dashboard
  if (isAdminOrManager()) {
    return <ManagerDashboard />;
  }

  // Para otros roles, mostrar la navegación tradicional
  return <RoleBasedNavigation />;
};
