
import React, { Suspense, useTransition } from "react";
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

// Lazy load pages for better First Contentful Paint
const Index = React.lazy(() => import("./pages/Index"));
const Auth = React.lazy(() => import("./pages/Auth"));
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
const PublicLaundryView = React.lazy(() => import("./pages/PublicLaundryView"));
const LaundryShareManagement = React.lazy(() => import("./pages/LaundryShareManagement"));
const LinenControlPage = React.lazy(() => import("./pages/LinenControlPage"));
const ClientBilling = React.lazy(() => import("./pages/ClientBilling"));

// Helper component to wrap lazy routes with error boundary and transition
const LazyRoute = ({ children }: { children: React.ReactNode }) => {
  const [isPending, startTransition] = useTransition();
  
  return (
    <LazyLoadErrorBoundary>
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      }>
        {children}
      </Suspense>
    </LazyLoadErrorBoundary>
  );
};

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
              <Route path="/auth" element={
                <LazyRoute>
                  <Auth />
                </LazyRoute>
              } />
              {/* Ruta pública para aceptar invitaciones */}
              <Route path="/accept-invitation" element={
                <LazyRoute>
                  <AcceptInvitation />
                </LazyRoute>
              } />
              {/* Ruta pública para vista de lavandería (repartidores sin cuenta) */}
              <Route path="/lavanderia/:token" element={
                <LazyRoute>
                  <PublicLaundryView />
                </LazyRoute>
              } />
              <Route path="/" element={
                <ProtectedRoute>
                  <LazyRoute>
                    <Index />
                  </LazyRoute>
                </ProtectedRoute>
              } />
              <Route path="/user-management" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="users">
                    <LazyRoute>
                      <UserManagement />
                    </LazyRoute>
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/sede-management" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="admin">
                    <LazyRoute>
                      <SedeManagement />
                    </LazyRoute>
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/admin/security" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="admin">
                    <LazyRoute>
                      <SecurityManagement />
                    </LazyRoute>
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/calendar" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="calendar">
                    <LazyRoute>
                      <Calendar />
                    </LazyRoute>
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/tasks" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="tasks">
                    <LazyRoute>
                      <Tasks />
                    </LazyRoute>
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/clients" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="clients">
                    <LazyRoute>
                      <Clients />
                    </LazyRoute>
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/properties" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="properties">
                    <LazyRoute>
                      <Properties />
                    </LazyRoute>
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/workers" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="workers">
                    <LazyRoute>
                      <Workers />
                    </LazyRoute>
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/property-groups" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="propertyGroups">
                    <LazyRoute>
                      <PropertyGroups />
                    </LazyRoute>
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/checklist-templates" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="tasks">
                    <LazyRoute>
                      <ChecklistTemplates />
                    </LazyRoute>
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/recurring-tasks" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="tasks">
                    <LazyRoute>
                      <RecurringTasksPage />
                    </LazyRoute>
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/reports" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="reports">
                    <LazyRoute>
                      <Reports />
                    </LazyRoute>
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/hostaway-sync-logs" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="hostaway">
                    <LazyRoute>
                      <HostawaySyncLogs />
                    </LazyRoute>
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/hostaway-automation" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="hostaway">
                    <LazyRoute>
                      <HostawayAutomation />
                    </LazyRoute>
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/cleaning-reports" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="reports">
                    <LazyRoute>
                      <CleaningReports />
                    </LazyRoute>
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/inventory" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="inventory">
                    <LazyRoute>
                      <InventoryDashboard />
                    </LazyRoute>
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/inventory/stock" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="inventory">
                    <LazyRoute>
                      <InventoryStock />
                    </LazyRoute>
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/inventory/movements" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="inventory">
                    <LazyRoute>
                      <InventoryMovements />
                    </LazyRoute>
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/inventory/config" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="inventory">
                    <LazyRoute>
                      <InventoryConfig />
                    </LazyRoute>
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/inventory/reports" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="inventory">
                    <LazyRoute>
                      <InventoryReports />
                    </LazyRoute>
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/logistics/dashboard" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="logistics">
                    <LazyRoute>
                      <LogisticsDashboard />
                    </LazyRoute>
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/logistics/reports" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="logistics">
                    <LazyRoute>
                      <LogisticsReports />
                    </LazyRoute>
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/logistics/picklists" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="logistics">
                    <LazyRoute>
                      <LogisticsPicklists />
                    </LazyRoute>
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/logistics/picklists/:id" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="logistics">
                    <LazyRoute>
                      <LogisticsPicklistDetails />
                    </LazyRoute>
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/logistics/picklists/:id/edit" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="logistics">
                    <LazyRoute>
                      <LogisticsPicklistEdit />
                    </LazyRoute>
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/logistics/deliveries" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="logistics">
                    <LazyRoute>
                      <LogisticsDeliveries />
                    </LazyRoute>
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/lavanderia/gestion" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="reports">
                    <LazyRoute>
                      <LaundryShareManagement />
                    </LazyRoute>
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/control-mudas" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="reports">
                    <LazyRoute>
                      <LinenControlPage />
                    </LazyRoute>
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/client-billing" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="reports">
                    <LazyRoute>
                      <ClientBilling />
                    </LazyRoute>
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="*" element={
                <LazyRoute>
                  <NotFound />
                </LazyRoute>
              } />
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
