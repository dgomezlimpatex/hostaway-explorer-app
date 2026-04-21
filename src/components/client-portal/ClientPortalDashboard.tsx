
import { useState } from 'react';
import { Building2, LogOut, Plus, Calendar, List, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useClientPortalBookings, useClientProperties } from '@/hooks/useClientPortal';
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
  const { data: bookings = [], isLoading: loadingBookings, refetch } = useClientPortalBookings(clientId);

  const upcomingBookings = bookings.filter(b => {
    const date = new Date(b.checkOutDate ?? b.cleaningDate);
    return date >= new Date() && b.status !== 'cancelled';
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="container max-w-4xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="font-semibold text-base sm:text-lg truncate">{clientName}</h1>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  {upcomingBookings.length} reservas próximas
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-4 sm:mb-6 h-auto">
            <TabsTrigger value="add" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 text-xs sm:text-sm">
              <Plus className="h-4 w-4" />
              <span>Añadir</span>
            </TabsTrigger>
            <TabsTrigger value="list" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 text-xs sm:text-sm">
              <List className="h-4 w-4" />
              <span>Reservas</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 text-xs sm:text-sm">
              <Calendar className="h-4 w-4" />
              <span>Calendario</span>
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
              clientName={clientName}
              bookings={bookings}
              properties={properties}
              isLoading={loadingBookings}
            />
          </TabsContent>

          <TabsContent value="calendar">
            <ReservationsCalendar
              bookings={bookings}
              isLoading={loadingBookings}
            />
          </TabsContent>
        </Tabs>
      </main>
      
      <Toaster />
    </div>
  );
};
