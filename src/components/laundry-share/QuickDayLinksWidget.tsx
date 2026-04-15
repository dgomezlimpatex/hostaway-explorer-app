import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Plus, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { format, addDays, subDays, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSede } from '@/contexts/SedeContext';
import { useLaundryShareLinks, LaundryShareLink } from '@/hooks/useLaundryShareLinks';
import { useLaundryDeliverySchedule } from '@/hooks/useLaundrySchedule';
import { copyShareLinkToClipboard, getShareLinkUrl, calculateExpirationDate } from '@/services/laundryShareService';
import { fetchTasksForDates } from '@/services/laundryScheduleService';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

/**
 * Given a delivery date and its schedule's collectionDays,
 * return the actual calendar dates for collection.
 * 
 * collectionDays contains day-of-week numbers (0=Sun..6=Sat).
 * We calculate how many days back each collection day is relative to the delivery day.
 */
const getCollectionDatesForDelivery = (deliveryDate: Date, collectionDays: number[]): Date[] => {
  const deliveryDow = getDay(deliveryDate); // 0-6
  return collectionDays.map(collDay => {
    let diff = deliveryDow - collDay;
    if (diff < 0) diff += 7;
    return subDays(deliveryDate, diff);
  }).sort((a, b) => a.getTime() - b.getTime());
};

interface QuickDayCardProps {
  label: string;
  date: Date;
  existingLink?: LaundryShareLink;
  onCreateLink: () => Promise<void>;
  isCreating: boolean;
  taskCount: number;
  isLoadingTasks: boolean;
  collectionDateLabels?: string;
}

const QuickDayCard = ({ 
  label, 
  date, 
  existingLink, 
  onCreateLink, 
  isCreating, 
  taskCount,
  isLoadingTasks,
  collectionDateLabels,
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
              {collectionDateLabels && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Recogida: {collectionDateLabels}
                </p>
              )}
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
  const { schedules } = useLaundryDeliverySchedule();
  const [creatingFor, setCreatingFor] = useState<'today' | 'tomorrow' | null>(null);

  const today = new Date();
  const tomorrow = addDays(today, 1);
  
  const todayStr = format(today, 'yyyy-MM-dd');
  const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');

  // Find matching schedule and collection dates for each day
  const todayScheduleInfo = useMemo(() => {
    const dow = getDay(today);
    const schedule = schedules?.find(s => s.dayOfWeek === dow && s.isActive);
    if (!schedule || schedule.collectionDays.length === 0) {
      return { collectionDates: [todayStr], collectionDateStrs: [todayStr], label: undefined };
    }
    const dates = getCollectionDatesForDelivery(today, schedule.collectionDays);
    const strs = dates.map(d => format(d, 'yyyy-MM-dd'));
    const label = dates.map(d => format(d, 'EEE d', { locale: es })).join(', ');
    return { collectionDates: dates, collectionDateStrs: strs, label, schedule };
  }, [todayStr, schedules]);

  const tomorrowScheduleInfo = useMemo(() => {
    const dow = getDay(tomorrow);
    const schedule = schedules?.find(s => s.dayOfWeek === dow && s.isActive);
    if (!schedule || schedule.collectionDays.length === 0) {
      return { collectionDates: [tomorrowStr], collectionDateStrs: [tomorrowStr], label: undefined };
    }
    const dates = getCollectionDatesForDelivery(tomorrow, schedule.collectionDays);
    const strs = dates.map(d => format(d, 'yyyy-MM-dd'));
    const label = dates.map(d => format(d, 'EEE d', { locale: es })).join(', ');
    return { collectionDates: dates, collectionDateStrs: strs, label, schedule };
  }, [tomorrowStr, schedules]);

  // Fetch task counts using ALL collection dates
  const { data: todayTasks, isLoading: loadingToday } = useQuery({
    queryKey: ['quick-day-tasks', todayStr, activeSede?.id, todayScheduleInfo.collectionDateStrs],
    queryFn: () => fetchTasksForDates(todayScheduleInfo.collectionDateStrs, activeSede?.id || ''),
    enabled: !!activeSede?.id,
  });

  const { data: tomorrowTasks, isLoading: loadingTomorrow } = useQuery({
    queryKey: ['quick-day-tasks', tomorrowStr, activeSede?.id, tomorrowScheduleInfo.collectionDateStrs],
    queryFn: () => fetchTasksForDates(tomorrowScheduleInfo.collectionDateStrs, activeSede?.id || ''),
    enabled: !!activeSede?.id,
  });

  // Find existing scheduled links for today and tomorrow
  const scheduledLinks = shareLinks?.filter(l => l.linkType === 'scheduled') || [];
  
  const todayLink = scheduledLinks.find(l => 
    l.dateStart === todayStr && l.dateEnd === todayStr
  ) || scheduledLinks.find(l => {
    // Also match links where the delivery date (dateEnd) is today
    const strs = todayScheduleInfo.collectionDateStrs;
    return l.dateStart === strs[0] && l.dateEnd === strs[strs.length - 1];
  });
  
  const tomorrowLink = scheduledLinks.find(l => 
    l.dateStart === tomorrowStr && l.dateEnd === tomorrowStr
  ) || scheduledLinks.find(l => {
    const strs = tomorrowScheduleInfo.collectionDateStrs;
    return l.dateStart === strs[0] && l.dateEnd === strs[strs.length - 1];
  });

  const handleCreateLink = async (date: Date, dayType: 'today' | 'tomorrow') => {
    if (!activeSede?.id) return;

    setCreatingFor(dayType);
    
    try {
      const info = dayType === 'today' ? todayScheduleInfo : tomorrowScheduleInfo;
      const tasks = await fetchTasksForDates(info.collectionDateStrs, activeSede.id);
      
      if (tasks.length === 0) {
        toast({
          title: 'Sin servicios',
          description: 'No hay servicios programados para estas fechas',
          variant: 'destructive',
        });
        return;
      }

      const taskIds = tasks.map(t => t.taskId);
      const expiresAt = calculateExpirationDate('week');
      
      const dateStart = info.collectionDateStrs[0];
      const dateEnd = info.collectionDateStrs[info.collectionDateStrs.length - 1];

      await createShareLink.mutateAsync({
        dateStart,
        dateEnd,
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
        collectionDateLabels={todayScheduleInfo.label}
      />
      <QuickDayCard
        label="Mañana"
        date={tomorrow}
        existingLink={tomorrowLink}
        onCreateLink={() => handleCreateLink(tomorrow, 'tomorrow')}
        isCreating={creatingFor === 'tomorrow'}
        taskCount={tomorrowTasks?.length || 0}
        isLoadingTasks={loadingTomorrow}
        collectionDateLabels={tomorrowScheduleInfo.label}
      />
    </div>
  );
};
