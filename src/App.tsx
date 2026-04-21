
import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthProvider";
import { SedeContextProvider } from "@/contexts/SedeContextProvider";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { RoleProtectedRoute } from "@/components/auth/RoleProtectedRoute";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import { LazyLoadErrorBoundary } from "@/components/common/LazyLoadErrorBoundary";
import { AppLayout } from "@/components/layout/AppLayout";

// Lazy load pages for better First Contentful Paint
const Index = React.lazy(() => import("./pages/Index"));
const Auth = React.lazy(() => import("./pages/Auth"));
const ForgotPassword = React.lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = React.lazy(() => import("./pages/ResetPassword"));
const AcceptInvitation = React.lazy(() => import("./pages/AcceptInvitation"));
const UserManagement = React.lazy(() => import("./pages/UserManagement"));
const SedeManagement = React.lazy(() => import("./pages/SedeManagement"));
const SecurityManagement = React.lazy(() => import("./pages/SecurityManagement"));
const Calendar = React.lazy(() => import("./pages/Calendar"));
const Tasks = React.lazy(() => import("./pages/Tasks"));
const Clients = React.lazy(() => import("./pages/Clients"));
const Properties = React.lazy(() => import("./pages/Properties"));
const Workers = React.lazy(() => import("./pages/Workers"));
const PropertyGroups = React.lazy(() => import("./pages/PropertyGroups"));
const Reports = React.lazy(() => import("./pages/Reports"));
const HostawaySyncLogs = React.lazy(() => import("./pages/HostawaySyncLogs"));
const ChecklistTemplates = React.lazy(() => import("./pages/ChecklistTemplates"));
const CleaningReports = React.lazy(() => import("./pages/CleaningReports"));
const InventoryDashboard = React.lazy(() => import("./pages/InventoryDashboard"));
const InventoryStock = React.lazy(() => import("./pages/InventoryStock"));
const InventoryMovements = React.lazy(() => import("./pages/InventoryMovements"));
const InventoryConfig = React.lazy(() => import("./pages/InventoryConfig"));
const InventoryReports = React.lazy(() => import("./pages/InventoryReports"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const LogisticsPicklists = React.lazy(() => import("./pages/LogisticsPicklists"));
const LogisticsPicklistDetails = React.lazy(() => import("./pages/LogisticsPicklistDetails"));
const LogisticsPicklistEdit = React.lazy(() => import("./pages/LogisticsPicklistEdit"));
const LogisticsDeliveries = React.lazy(() => import("./pages/LogisticsDeliveries"));
const LogisticsDashboard = React.lazy(() => import("./pages/LogisticsDashboard"));
const LogisticsReports = React.lazy(() => import("./pages/LogisticsReports"));
const RecurringTasksPage = React.lazy(() => import("./pages/RecurringTasksPage"));
const HostawayAutomation = React.lazy(() => import("./pages/HostawayAutomation"));
const AvantioAutomation = React.lazy(() => import("./pages/AvantioAutomation"));
const PublicLaundryView = React.lazy(() => import("./pages/PublicLaundryView"));
const PublicLaundryScheduledView = React.lazy(() => import("./pages/PublicLaundryScheduledView"));
const LaundryShareManagement = React.lazy(() => import("./pages/LaundryShareManagement"));
const LinenControlPage = React.lazy(() => import("./pages/LinenControlPage"));
const ClientBilling = React.lazy(() => import("./pages/ClientBilling"));
const OperationalAnalytics = React.lazy(() => import("./pages/OperationalAnalytics"));
const ClientPortal = React.lazy(() => import("./pages/ClientPortal"));
const ClientReservationsAdmin = React.lazy(() => import("./pages/ClientReservationsAdmin"));
const WorkloadDashboard = React.lazy(() => import("./pages/WorkloadDashboard"));
const StaffingForecast = React.lazy(() => import("./pages/StaffingForecast"));
const ForecastSettings = React.lazy(() => import("./pages/ForecastSettings"));

// Suspense fallback for routes loaded WITHOUT the persistent layout (auth, public, calendar)
const FullPageSuspense = ({ children }: { children: React.ReactNode }) => (
  <LazyLoadErrorBoundary>
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      }
    >
      {children}
    </Suspense>
  </LazyLoadErrorBoundary>
);

const queryClient = new QueryClient();

// Security wrapper component
function SecurityWrapper({ children }: { children: React.ReactNode }) {
  useSessionTimeout();
  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <SedeContextProvider>
            <SecurityWrapper>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  {/* Rutas públicas / auth (sin sidebar) */}
                  <Route path="/auth" element={<FullPageSuspense><Auth /></FullPageSuspense>} />
                  <Route path="/forgot-password" element={<FullPageSuspense><ForgotPassword /></FullPageSuspense>} />
                  <Route path="/reset-password" element={<FullPageSuspense><ResetPassword /></FullPageSuspense>} />
                  <Route path="/accept-invitation" element={<FullPageSuspense><AcceptInvitation /></FullPageSuspense>} />
                  <Route path="/lavanderia/:token" element={<FullPageSuspense><PublicLaundryView /></FullPageSuspense>} />
                  <Route path="/reparto/:token" element={<FullPageSuspense><PublicLaundryScheduledView /></FullPageSuspense>} />
                  <Route path="/portal/:identifier" element={<FullPageSuspense><ClientPortal /></FullPageSuspense>} />

                  {/* Calendario: pantalla completa, SIN sidebar persistente */}
                  <Route path="/calendar" element={
                    <ProtectedRoute>
                      <RoleProtectedRoute requiredModule="calendar">
                        <FullPageSuspense><Calendar /></FullPageSuspense>
                      </RoleProtectedRoute>
                    </ProtectedRoute>
                  } />

                  {/* Inventario: tiene su propio layout interno */}
                  <Route path="/inventory" element={
                    <ProtectedRoute>
                      <RoleProtectedRoute requiredModule="inventory">
                        <FullPageSuspense><InventoryDashboard /></FullPageSuspense>
                      </RoleProtectedRoute>
                    </ProtectedRoute>
                  } />
                  <Route path="/inventory/stock" element={
                    <ProtectedRoute>
                      <RoleProtectedRoute requiredModule="inventory">
                        <FullPageSuspense><InventoryStock /></FullPageSuspense>
                      </RoleProtectedRoute>
                    </ProtectedRoute>
                  } />
                  <Route path="/inventory/movements" element={
                    <ProtectedRoute>
                      <RoleProtectedRoute requiredModule="inventory">
                        <FullPageSuspense><InventoryMovements /></FullPageSuspense>
                      </RoleProtectedRoute>
                    </ProtectedRoute>
                  } />
                  <Route path="/inventory/config" element={
                    <ProtectedRoute>
                      <RoleProtectedRoute requiredModule="inventory">
                        <FullPageSuspense><InventoryConfig /></FullPageSuspense>
                      </RoleProtectedRoute>
                    </ProtectedRoute>
                  } />
                  <Route path="/inventory/reports" element={
                    <ProtectedRoute>
                      <RoleProtectedRoute requiredModule="inventory">
                        <FullPageSuspense><InventoryReports /></FullPageSuspense>
                      </RoleProtectedRoute>
                    </ProtectedRoute>
                  } />

                  {/* Layout persistente con sidebar - todas las páginas admin */}
                  <Route element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }>
                    <Route path="/" element={<Index />} />
                    <Route path="/user-management" element={
                      <RoleProtectedRoute requiredModule="users"><UserManagement /></RoleProtectedRoute>
                    } />
                    <Route path="/sede-management" element={
                      <RoleProtectedRoute requiredModule="admin"><SedeManagement /></RoleProtectedRoute>
                    } />
                    <Route path="/admin/security" element={
                      <RoleProtectedRoute requiredModule="admin"><SecurityManagement /></RoleProtectedRoute>
                    } />
                    <Route path="/tasks" element={
                      <RoleProtectedRoute requiredModule="tasks"><Tasks /></RoleProtectedRoute>
                    } />
                    <Route path="/clients" element={
                      <RoleProtectedRoute requiredModule="clients"><Clients /></RoleProtectedRoute>
                    } />
                    <Route path="/properties" element={
                      <RoleProtectedRoute requiredModule="properties"><Properties /></RoleProtectedRoute>
                    } />
                    <Route path="/client-reservations" element={
                      <RoleProtectedRoute requiredModule="clients"><ClientReservationsAdmin /></RoleProtectedRoute>
                    } />
                    <Route path="/workers" element={
                      <RoleProtectedRoute requiredModule="workers"><Workers /></RoleProtectedRoute>
                    } />
                    <Route path="/property-groups" element={
                      <RoleProtectedRoute requiredModule="propertyGroups"><PropertyGroups /></RoleProtectedRoute>
                    } />
                    <Route path="/checklist-templates" element={
                      <RoleProtectedRoute requiredModule="tasks"><ChecklistTemplates /></RoleProtectedRoute>
                    } />
                    <Route path="/recurring-tasks" element={
                      <RoleProtectedRoute requiredModule="tasks"><RecurringTasksPage /></RoleProtectedRoute>
                    } />
                    <Route path="/reports" element={
                      <RoleProtectedRoute requiredModule="reports"><Reports /></RoleProtectedRoute>
                    } />
                    <Route path="/hostaway-sync-logs" element={
                      <RoleProtectedRoute requiredModule="hostaway"><HostawaySyncLogs /></RoleProtectedRoute>
                    } />
                    <Route path="/hostaway-automation" element={
                      <RoleProtectedRoute requiredModule="hostaway"><HostawayAutomation /></RoleProtectedRoute>
                    } />
                    <Route path="/avantio-automation" element={
                      <RoleProtectedRoute requiredModule="hostaway"><AvantioAutomation /></RoleProtectedRoute>
                    } />
                    <Route path="/cleaning-reports" element={
                      <RoleProtectedRoute requiredModule="reports"><CleaningReports /></RoleProtectedRoute>
                    } />
                    <Route path="/logistics/dashboard" element={
                      <RoleProtectedRoute requiredModule="logistics"><LogisticsDashboard /></RoleProtectedRoute>
                    } />
                    <Route path="/logistics/reports" element={
                      <RoleProtectedRoute requiredModule="logistics"><LogisticsReports /></RoleProtectedRoute>
                    } />
                    <Route path="/logistics/picklists" element={
                      <RoleProtectedRoute requiredModule="logistics"><LogisticsPicklists /></RoleProtectedRoute>
                    } />
                    <Route path="/logistics/picklists/:id" element={
                      <RoleProtectedRoute requiredModule="logistics"><LogisticsPicklistDetails /></RoleProtectedRoute>
                    } />
                    <Route path="/logistics/picklists/:id/edit" element={
                      <RoleProtectedRoute requiredModule="logistics"><LogisticsPicklistEdit /></RoleProtectedRoute>
                    } />
                    <Route path="/logistics/deliveries" element={
                      <RoleProtectedRoute requiredModule="logistics"><LogisticsDeliveries /></RoleProtectedRoute>
                    } />
                    <Route path="/lavanderia/gestion" element={
                      <RoleProtectedRoute requiredModule="reports"><LaundryShareManagement /></RoleProtectedRoute>
                    } />
                    <Route path="/control-mudas" element={
                      <RoleProtectedRoute requiredModule="reports"><LinenControlPage /></RoleProtectedRoute>
                    } />
                    <Route path="/client-billing" element={
                      <RoleProtectedRoute requiredModule="reports"><ClientBilling /></RoleProtectedRoute>
                    } />
                    <Route path="/operational-analytics" element={
                      <RoleProtectedRoute requiredModule="reports"><OperationalAnalytics /></RoleProtectedRoute>
                    } />
                    <Route path="/workload" element={
                      <RoleProtectedRoute requiredModule="workers"><WorkloadDashboard /></RoleProtectedRoute>
                    } />
                    <Route path="/forecast" element={
                      <RoleProtectedRoute requiredModule="workers"><StaffingForecast /></RoleProtectedRoute>
                    } />
                    <Route path="/forecast/settings" element={
                      <RoleProtectedRoute requiredModule="workers"><ForecastSettings /></RoleProtectedRoute>
                    } />
                  </Route>

                  <Route path="*" element={<FullPageSuspense><NotFound /></FullPageSuspense>} />
                </Routes>
              </BrowserRouter>
            </SecurityWrapper>
          </SedeContextProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
