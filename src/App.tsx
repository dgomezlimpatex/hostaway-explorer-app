
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthProvider";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { RoleProtectedRoute } from "@/components/auth/RoleProtectedRoute";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AcceptInvitation from "./pages/AcceptInvitation";
import UserManagement from "./pages/UserManagement";
import Calendar from "./pages/Calendar";
import Tasks from "./pages/Tasks";
import Clients from "./pages/Clients";
import Properties from "./pages/Properties";
import Workers from "./pages/Workers";
import PropertyGroups from "./pages/PropertyGroups";
import Reports from "./pages/Reports";
import HostawaySyncLogs from "./pages/HostawaySyncLogs";
import ChecklistTemplates from "./pages/ChecklistTemplates";
import CleaningReports from "./pages/CleaningReports";
import InventoryDashboard from "./pages/InventoryDashboard";
import InventoryStock from "./pages/InventoryStock";
import InventoryMovements from "./pages/InventoryMovements";
import InventoryConfig from "./pages/InventoryConfig";
import InventoryReports from "./pages/InventoryReports";
import NotFound from "./pages/NotFound";
import LogisticsPicklists from "./pages/LogisticsPicklists";
import LogisticsPicklistDetails from "./pages/LogisticsPicklistDetails";
import LogisticsPicklistEdit from "./pages/LogisticsPicklistEdit";
import LogisticsDeliveries from "./pages/LogisticsDeliveries";
import LogisticsDashboard from "./pages/LogisticsDashboard";
import LogisticsReports from "./pages/LogisticsReports";

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
                  <Index />
                </ProtectedRoute>
              } />
              <Route path="/user-management" element={
                <ProtectedRoute>
                  <RoleProtectedRoute requiredModule="users">
                    <UserManagement />
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
                    <Clients />
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
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
