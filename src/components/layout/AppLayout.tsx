import { lazy, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { useRolePermissions } from '@/hooks/useRolePermissions';

const ManagementAppLayout = lazy(() => import('./ManagementAppLayout'));
const loading = <div role="status" className="p-8 text-center">Cargando…</div>;

export function AppLayout() {
  const { isCleaner } = useRolePermissions();
  return isCleaner()
    ? <main className="min-h-screen w-full"><Suspense fallback={loading}><Outlet /></Suspense></main>
    : <Suspense fallback={loading}><ManagementAppLayout /></Suspense>;
}

export default AppLayout;
