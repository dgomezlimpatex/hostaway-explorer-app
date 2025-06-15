import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthProvider";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import HostawaySyncLogs from "./pages/HostawaySyncLogs";
import Index from "./pages/Index";
import Calendar from "./pages/Calendar";
import Tasks from "./pages/Tasks";
import Clients from "./pages/Clients";
import Properties from "./pages/Properties";
import Workers from "./pages/Workers";
import Reports from "./pages/Reports";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Index />
              </ProtectedRoute>
            } />
            <Route path="/calendar" element={
              <ProtectedRoute requireRole={['admin', 'manager', 'supervisor']}>
                <Calendar />
              </ProtectedRoute>
            } />
            <Route path="/tasks" element={
              <ProtectedRoute>
                <Tasks />
              </ProtectedRoute>
            } />
            <Route path="/clients" element={
              <ProtectedRoute requireRole={['admin', 'manager', 'supervisor']}>
                <Clients />
              </ProtectedRoute>
            } />
            <Route path="/properties" element={
              <ProtectedRoute requireRole={['admin', 'manager', 'supervisor']}>
                <Properties />
              </ProtectedRoute>
            } />
            <Route path="/workers" element={
              <ProtectedRoute requireRole={['admin', 'manager']}>
                <Workers />
              </ProtectedRoute>
            } />
            <Route path="/reports" element={
              <ProtectedRoute requireRole={['admin', 'manager', 'supervisor']}>
                <Reports />
              </ProtectedRoute>
            } />
            <Route path="/hostaway-sync-logs" element={
              <ProtectedRoute requireRole={['admin', 'manager']}>
                <HostawaySyncLogs />
              </ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
