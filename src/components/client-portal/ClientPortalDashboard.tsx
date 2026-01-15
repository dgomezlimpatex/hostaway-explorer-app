
import { useState } from 'react';
import { Building2, LogOut, Plus, Calendar, List, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useClientReservations, useClientProperties } from '@/hooks/useClientPortal';
import { QuickAddReservations } from './QuickAddReservations';
import { ReservationsList } from './ReservationsList';
import { ReservationsCalendar } from './ReservationsCalendar';
import { Toaster } from '@/components/ui/toaster';

interface ClientPortalDashboardProps {
  clientId: string;
  clientName: string;
  onLogout: () => void;
}

export const ClientPortalDashboard = ({
  clientId,
  clientName,
  onLogout,
}: ClientPortalDashboardProps) => {
  const [activeTab, setActiveTab] = useState('add');
  
  const { data: properties = [], isLoading: loadingProperties } = useClientProperties(clientId);
  const { data: reservations = [], isLoading: loadingReservations, refetch } = useClientReservations(clientId);

  const upcomingReservations = reservations.filter(r => {
    const checkoutDate = new Date(r.checkOutDate);
    return checkoutDate >= new Date() && r.status === 'active';
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="container max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="font-semibold text-lg">{clientName}</h1>
                <p className="text-sm text-muted-foreground">
                  {upcomingReservations.length} reservas próximas
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container max-w-4xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="add" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Añadir</span>
            </TabsTrigger>
            <TabsTrigger value="list" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Reservas</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Calendario</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="add">
            <QuickAddReservations
              clientId={clientId}
              properties={properties}
              isLoading={loadingProperties}
              onSuccess={() => {
                refetch();
                setActiveTab('list');
              }}
            />
          </TabsContent>

          <TabsContent value="list">
            <ReservationsList
              clientId={clientId}
              reservations={reservations}
              properties={properties}
              isLoading={loadingReservations}
            />
          </TabsContent>

          <TabsContent value="calendar">
            <ReservationsCalendar
              reservations={reservations}
              isLoading={loadingReservations}
            />
          </TabsContent>
        </Tabs>
      </main>
      
      <Toaster />
    </div>
  );
};
