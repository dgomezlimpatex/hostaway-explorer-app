
import { RoleBasedNavigation } from '@/components/navigation/RoleBasedNavigation';
import { HostawayIntegrationWidget } from '@/components/hostaway/HostawayIntegrationWidget';
import { useRolePermissions } from '@/hooks/useRolePermissions';

export const MainDashboard = () => {
  const { canAccessModule } = useRolePermissions();

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
