import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { isRouteV2Owner } from '@/utils/routeV2Access';

interface OwnerOnlyRouteProps {
  children: ReactNode;
}

export function OwnerOnlyRoute({ children }: OwnerOnlyRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !isRouteV2Owner(user.email)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
