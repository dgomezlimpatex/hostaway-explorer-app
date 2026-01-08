import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Plus, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSede } from '@/contexts/SedeContext';
import { useLaundryShareLinks, LaundryShareLink } from '@/hooks/useLaundryShareLinks';
import { copyShareLinkToClipboard, getShareLinkUrl, calculateExpirationDate } from '@/services/laundryShareService';
import { fetchTasksForDates } from '@/services/laundryScheduleService';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

interface QuickDayCardProps {
  label: string;
  date: Date;
  existingLink?: LaundryShareLink;
  onCreateLink: () => Promise<void>;
  isCreating: boolean;
  taskCount: number;
  isLoadingTasks: boolean;
}

const QuickDayCard = ({ 
  label, 
  date, 
  existingLink, 
  onCreateLink, 
  isCreating, 
  taskCount,
  isLoadingTasks 
}: QuickDayCardProps) => {
  const { toast } = useToast();
  const dayName = format(date, 'EEEE', { locale: es });
  const dateFormatted = format(date, "d 'de' MMMM", { locale: es });

  const handleCopy = async () => {
    if (existingLink) {
      const success = await copyShareLinkToClipboard(existingLink.token, true);
      if (success) {
        toast({
          title: 'Enlace copiado',
          description: 'Ya puedes compartirlo por WhatsApp',
        });
      }
    }
  };

  const handleOpen = () => {
    if (existingLink) {
      window.open(getShareLinkUrl(existingLink.token, true), '_blank');
    }
  };

  return (
    <Card className="flex-1 bg-gradient-to-br from-muted/50 to-transparent border-muted-foreground/10 hover:border-primary/20 transition-all">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 shrink-0">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{label}</span>
                <Badge variant="secondary" className="text-xs capitalize">
                  {dayName}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground capitalize">{dateFormatted}</p>
              {!existingLink && (
                <p className="text-xs text-muted-foreground mt-1">
                  {isLoadingTasks ? '...' : `${taskCount} servicios`}
                </p>
              )}
            </div>
            
            {existingLink ? (
              <div className="flex items-center gap-2">
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="flex-1"
                  onClick={handleCopy}
                >
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Copiar
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleOpen}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button 
                size="sm" 
                className="w-full"
                onClick={onCreateLink}
                disabled={isCreating || taskCount === 0}
              >
                {isCreating ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                )}
                Crear enlace
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const QuickDayLinksWidget = () => {
  const { activeSede } = useSede();
  const { toast } = useToast();
  const { shareLinks, createShareLink, refetch } = useLaundryShareLinks();
  const [creatingFor, setCreatingFor] = useState<'today' | 'tomorrow' | null>(null);

  const today = new Date();
  const tomorrow = addDays(today, 1);
  
  const todayStr = format(today, 'yyyy-MM-dd');
  const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');

  // Fetch task counts for today and tomorrow
  const { data: todayTasks, isLoading: loadingToday } = useQuery({
    queryKey: ['quick-day-tasks', todayStr, activeSede?.id],
    queryFn: () => fetchTasksForDates([todayStr], activeSede?.id || ''),
    enabled: !!activeSede?.id,
  });

  const { data: tomorrowTasks, isLoading: loadingTomorrow } = useQuery({
    queryKey: ['quick-day-tasks', tomorrowStr, activeSede?.id],
    queryFn: () => fetchTasksForDates([tomorrowStr], activeSede?.id || ''),
    enabled: !!activeSede?.id,
  });

  // Find existing scheduled links for today and tomorrow
  const scheduledLinks = shareLinks?.filter(l => l.linkType === 'scheduled') || [];
  
  const todayLink = scheduledLinks.find(l => 
    l.dateStart === todayStr && l.dateEnd === todayStr
  );
  
  const tomorrowLink = scheduledLinks.find(l => 
    l.dateStart === tomorrowStr && l.dateEnd === tomorrowStr
  );

  const handleCreateLink = async (date: Date, dayType: 'today' | 'tomorrow') => {
    if (!activeSede?.id) return;

    setCreatingFor(dayType);
    
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const tasks = await fetchTasksForDates([dateStr], activeSede.id);
      
      if (tasks.length === 0) {
        toast({
          title: 'Sin servicios',
          description: 'No hay servicios programados para esta fecha',
          variant: 'destructive',
        });
        return;
      }

      const taskIds = tasks.map(t => t.taskId);
      const expiresAt = calculateExpirationDate('week');

      await createShareLink.mutateAsync({
        dateStart: dateStr,
        dateEnd: dateStr,
        taskIds: taskIds,
        allTaskIds: taskIds,
        isPermanent: false,
        expiresAt,
        filters: { sedeId: activeSede.id },
        linkType: 'scheduled',
        sedeId: activeSede.id,
      });

      await refetch();
      
      toast({
        title: 'Enlace creado',
        description: `Enlace para ${dayType === 'today' ? 'hoy' : 'mañana'} generado correctamente`,
      });
    } catch (error) {
      console.error('Error creating quick link:', error);
      toast({
        title: 'Error',
        description: 'No se pudo crear el enlace',
        variant: 'destructive',
      });
    } finally {
      setCreatingFor(null);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <QuickDayCard
        label="Hoy"
        date={today}
        existingLink={todayLink}
        onCreateLink={() => handleCreateLink(today, 'today')}
        isCreating={creatingFor === 'today'}
        taskCount={todayTasks?.length || 0}
        isLoadingTasks={loadingToday}
      />
      <QuickDayCard
        label="Mañana"
        date={tomorrow}
        existingLink={tomorrowLink}
        onCreateLink={() => handleCreateLink(tomorrow, 'tomorrow')}
        isCreating={creatingFor === 'tomorrow'}
        taskCount={tomorrowTasks?.length || 0}
        isLoadingTasks={loadingTomorrow}
      />
    </div>
  );
};
