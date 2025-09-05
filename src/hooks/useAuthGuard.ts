import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSede } from '@/contexts/SedeContext';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook para validar que el usuario tenga acceso completo al sistema
 * Verifica autenticación, rol y acceso a sedes
 */
export const useAuthGuard = () => {
  const { user, userRole, isLoading: authLoading } = useAuth();
  const { availableSedes, loading: sedeLoading, isInitialized } = useSede();
  const { toast } = useToast();

  const isLoading = authLoading || sedeLoading || !isInitialized;
  const isAuthenticated = !!user;
  const hasRole = !!userRole;
  const hasSedeAccess = availableSedes && availableSedes.length > 0;
  const hasFullAccess = isAuthenticated && hasRole && hasSedeAccess;

  // Show warning if user has no sede access after loading
  useEffect(() => {
    if (!isLoading && isAuthenticated && hasRole && !hasSedeAccess) {
      toast({
        title: 'Acceso Restringido',
        description: 'No tienes acceso a ninguna sede. Contacta con un administrador.',
        variant: 'destructive',
        duration: 10000, // Show longer for important message
      });
    }
  }, [isLoading, isAuthenticated, hasRole, hasSedeAccess, toast]);

  return {
    isLoading,
    isAuthenticated,
    hasRole,
    hasSedeAccess,
    hasFullAccess,
    user,
    userRole,
    availableSedes,
    // Helper function to check specific permissions
    canAccessRoute: (requiredRoles?: string[]) => {
      if (!hasFullAccess || !userRole) return false;
      if (!requiredRoles) return true;
      return requiredRoles.includes(userRole);
    }
  };
};