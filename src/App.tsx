
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthProvider";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { RoleProtectedRoute } from "@/components/auth/RoleProtectedRoute";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
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
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
