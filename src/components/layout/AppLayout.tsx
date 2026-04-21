import React, { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { MobileDashboardHeader } from '@/components/dashboard/MobileDashboardHeader';
import { useIsMobile } from '@/hooks/use-mobile';

/**
 * Layout persistente para todas las páginas de gestión.
 *
 * El SidebarProvider y el DashboardSidebar se montan UNA sola vez y
 * permanecen en el DOM al navegar entre rutas hijas. Esto evita el
 * "flash blanco" entre páginas y hace que la transición sea instantánea.
 *
 * El Suspense interno solo envuelve el <Outlet/>, así el sidebar nunca
 * se desmonta mientras se carga la siguiente página perezosa.
 */
export const AppLayout = () => {
  const isMobile = useIsMobile();

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full bg-background">
        <MobileDashboardHeader />
        <div className="flex min-h-screen w-full">
          {!isMobile && <DashboardSidebar />}
          <main className="flex-1 overflow-auto min-w-0">
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
