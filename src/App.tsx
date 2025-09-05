
import React from "react";
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

// Helper component to wrap lazy routes with error boundary
const LazyRoute = ({ children }: { children: React.ReactNode }) => (
  <LazyLoadErrorBoundary>
    {children}
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
              <Route path="/auth" element={<Auth />} />
              {/* Ruta pública para aceptar invitaciones */}
              <Route path="/accept-invitation" element={<AcceptInvitation />} />
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
                    <UserManagement />
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/sede-management" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="admin">
                    <SedeManagement />
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/admin/security" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="admin">
                    <SecurityManagement />
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/calendar" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="calendar">
                    <Calendar />
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/tasks" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="tasks">
                    <Tasks />
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
                    <Properties />
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/workers" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="workers">
                    <Workers />
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/property-groups" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="propertyGroups">
                    <PropertyGroups />
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/checklist-templates" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="tasks">
                    <ChecklistTemplates />
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/reports" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="reports">
                    <Reports />
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/hostaway-sync-logs" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="hostaway">
                    <HostawaySyncLogs />
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/cleaning-reports" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="reports">
                    <CleaningReports />
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/inventory" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="inventory">
                    <InventoryDashboard />
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/inventory/stock" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="inventory">
                    <InventoryStock />
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/inventory/movements" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="inventory">
                    <InventoryMovements />
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/inventory/config" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="inventory">
                    <InventoryConfig />
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/inventory/reports" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="inventory">
                    <InventoryReports />
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/logistics/dashboard" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="logistics">
                    <LogisticsDashboard />
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/logistics/reports" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="logistics">
                    <LogisticsReports />
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/logistics/picklists" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="logistics">
                    <LogisticsPicklists />
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/logistics/picklists/:id" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="logistics">
                    <LogisticsPicklistDetails />
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/logistics/picklists/:id/edit" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="logistics">
                    <LogisticsPicklistEdit />
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="/logistics/deliveries" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="logistics">
                    <LogisticsDeliveries />
                  </RoleProtectedRoute>
                </ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
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
