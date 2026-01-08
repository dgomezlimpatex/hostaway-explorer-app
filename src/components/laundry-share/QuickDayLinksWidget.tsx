import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Truck, Plus, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSede } from '@/contexts/SedeContext';
import { useLaundryShareLinks, LaundryShareLink } from '@/hooks/useLaundryShareLinks';
import { copyShareLinkToClipboard, getShareLinkUrl } from '@/services/laundryShareService';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface QuickDayCardProps {
  label: string;
  date: Date;
  existingLink?: LaundryShareLink;
  onCreateClick: () => void;
  isCreating: boolean;
}

const QuickDayCard = ({ label, date, existingLink, onCreateClick, isCreating }: QuickDayCardProps) => {
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
                onClick={onCreateClick}
                disabled={isCreating}
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

interface QuickDayLinksWidgetProps {
  onOpenScheduledModal: (preselectedDate?: Date) => void;
}

export const QuickDayLinksWidget = ({ onOpenScheduledModal }: QuickDayLinksWidgetProps) => {
  const { activeSede } = useSede();
  const { shareLinks } = useLaundryShareLinks();
  const [creatingFor, setCreatingFor] = useState<'today' | 'tomorrow' | null>(null);

  const today = new Date();
  const tomorrow = addDays(today, 1);
  
  const todayStr = format(today, 'yyyy-MM-dd');
  const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');

  // Find existing scheduled links for today and tomorrow
  const scheduledLinks = shareLinks?.filter(l => l.linkType === 'scheduled') || [];
  
  const todayLink = scheduledLinks.find(l => 
    l.dateStart === todayStr && l.dateEnd === todayStr
  );
  
  const tomorrowLink = scheduledLinks.find(l => 
    l.dateStart === tomorrowStr && l.dateEnd === tomorrowStr
  );

  const handleCreateToday = () => {
    setCreatingFor('today');
    onOpenScheduledModal(today);
  };

  const handleCreateTomorrow = () => {
    setCreatingFor('tomorrow');
    onOpenScheduledModal(tomorrow);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <QuickDayCard
        label="Hoy"
        date={today}
        existingLink={todayLink}
        onCreateClick={handleCreateToday}
        isCreating={creatingFor === 'today'}
      />
      <QuickDayCard
        label="Mañana"
        date={tomorrow}
        existingLink={tomorrowLink}
        onCreateClick={handleCreateTomorrow}
        isCreating={creatingFor === 'tomorrow'}
      />
    </div>
  );
};
