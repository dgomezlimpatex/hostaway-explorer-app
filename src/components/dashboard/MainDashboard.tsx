
import { RoleBasedNavigation } from '@/components/navigation/RoleBasedNavigation';
import { HostawayIntegrationWidget } from '@/components/hostaway/HostawayIntegrationWidget';
import { ManagerDashboard } from './ManagerDashboard';
import { useRolePermissions } from '@/hooks/useRolePermissions';

export const MainDashboard = () => {
  const { canAccessModule, isAdminOrManager } = useRolePermissions();

  // Si es admin o manager, mostrar el nuevo dashboard
  if (isAdminOrManager()) {
    return <ManagerDashboard />;
  }

  // Para otros roles, mostrar la navegación tradicional
  return (
    <div>
      {/* Solo mostrar widget de Hostaway si tiene permisos */}
      {canAccessModule('hostaway') && (
        <div className="mb-8 max-w-7xl mx-auto px-6">
          <HostawayIntegrationWidget />
        </div>
      )}
      
      <RoleBasedNavigation />
    </div>
  );
};
