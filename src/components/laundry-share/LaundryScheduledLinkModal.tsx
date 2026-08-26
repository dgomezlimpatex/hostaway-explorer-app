import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Check, Copy, ExternalLink, Loader2, Package, Truck } from 'lucide-react';
import { addDays, format, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { useLaundryShareLinks } from '@/hooks/useLaundryShareLinks';
import { copyShareLinkToClipboard, getShareLinkUrl, isShareLinkExpired } from '@/services/laundryShareService';
import { fetchTasksForDates } from '@/services/laundryScheduleService';
import { useToast } from '@/hooks/use-toast';
import { useSede } from '@/contexts/SedeContext';
import { calculateCollectionDates, useLaundryDeliverySchedule } from '@/hooks/useLaundrySchedule';

interface LaundryScheduledLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedDate?: Date;
}

const DEFAULT_EXPIRATION_DAYS = 30;
const MAX_OPTIONS = 10;

const toDateKey = (date: Date) => format(date, 'yyyy-MM-dd');

const getNextActiveDates = (from: Date, schedules: ReturnType<typeof useLaundryDeliverySchedule>['schedules']) => {
  if (!schedules?.length) return [];

  const activeDays = new Set(schedules.filter(schedule => schedule.isActive).map(schedule => schedule.dayOfWeek));
  const dates: Date[] = [];
  for (let offset = 0; offset <= 21 && dates.length < MAX_OPTIONS; offset += 1) {
    const date = addDays(from, offset);
    if (activeDays.has(getDay(date))) dates.push(date);
  }
  return dates;
};

export const LaundryScheduledLinkModal = ({
  open,
  onOpenChange,
  preselectedDate,
}: LaundryScheduledLinkModalProps) => {
  const { toast } = useToast();
  const { activeSede } = useSede();
  const { shareLinks, createShareLink } = useLaundryShareLinks();
  const { schedules } = useLaundryDeliverySchedule();
  const [deliveryDate, setDeliveryDate] = useState('');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewCount, setPreviewCount] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);

  const activeDates = useMemo(() => {
    const start = preselectedDate && preselectedDate >= new Date()
      ? preselectedDate
      : new Date();
    return getNextActiveDates(start, schedules);
  }, [preselectedDate, schedules]);

  const selectedDate = useMemo(
    () => activeDates.find(date => toDateKey(date) === deliveryDate) || null,
    [activeDates, deliveryDate],
  );

  const selectedSchedule = useMemo(
    () => schedules?.find(schedule => schedule.isActive && schedule.dayOfWeek === (selectedDate ? getDay(selectedDate) : -1)),
    [schedules, selectedDate],
  );

  const collectionDates = useMemo(() => {
    if (!selectedDate || !selectedSchedule) return [];
    return calculateCollectionDates(selectedDate, selectedSchedule).map(toDateKey);
  }, [selectedDate, selectedSchedule]);

  const existingLink = useMemo(() => {
    if (!deliveryDate) return undefined;
    return (shareLinks || []).find(link =>
      link.linkType === 'scheduled' &&
      link.workflowVersion !== 'route_v2' &&
      !isShareLinkExpired(link.expiresAt) &&
      (link.deliveryDate === deliveryDate || link.filters?.deliveryDate === deliveryDate),
    );
  }, [deliveryDate, shareLinks]);

  useEffect(() => {
    if (!open) return;
    setGeneratedLink(null);
    setCopied(false);
    setPreviewCount(0);
    const requested = preselectedDate ? toDateKey(preselectedDate) : '';
    const first = activeDates.find(date => toDateKey(date) === requested) || activeDates[0];
    setDeliveryDate(first ? toDateKey(first) : '');
  }, [open, preselectedDate, activeDates]);

  useEffect(() => {
    if (!open || !activeSede?.id || !collectionDates.length) {
      setPreviewCount(0);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    fetchTasksForDates(collectionDates, activeSede.id)
      .then(tasks => {
        if (!cancelled) setPreviewCount(tasks.length);
      })
      .catch(error => {
        console.error('Error loading laundry link preview:', error);
        if (!cancelled) setPreviewCount(0);
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, activeSede?.id, collectionDates]);

  const handleGenerate = async () => {
    if (!activeSede?.id || !selectedDate || !selectedSchedule || !collectionDates.length) {
      toast({
        title: 'Día no disponible',
        description: 'Selecciona uno de los próximos días activos de reparto.',
        variant: 'destructive',
      });
      return;
    }
    if (existingLink) {
      toast({
        title: 'Ya existe el enlace',
        description: 'Para este día ya hay un enlace activo. Puedes abrirlo o copiarlo desde la lista.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const tasks = await fetchTasksForDates(collectionDates, activeSede.id);
      const taskIds = tasks.map(task => task.taskId);
      const result = await createShareLink.mutateAsync({
        dateStart: collectionDates[0],
        dateEnd: collectionDates[collectionDates.length - 1],
        deliveryDate: toDateKey(selectedDate),
        expiresAt: addDays(new Date(), DEFAULT_EXPIRATION_DAYS).toISOString(),
        isPermanent: false,
        taskIds,
        allTaskIds: taskIds,
        sedeId: activeSede.id,
        deliveryDay: getDay(selectedDate),
        linkType: 'scheduled',
        workflowVersion: 'legacy',
        routeOrderApplied: true,
        filters: {
          sedeId: activeSede.id,
          workflowVersion: 'legacy',
          deliveryDate: toDateKey(selectedDate),
          collectionDates,
          routeDates: collectionDates,
        },
      });
      setGeneratedLink(getShareLinkUrl(result.token, true));
    } catch (error) {
      console.error('Error generating classic laundry link:', error);
      toast({
        title: 'No se pudo generar el enlace',
        description: error instanceof Error ? error.message : 'Revisa la configuración de reparto e inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedLink) return;
    const token = generatedLink.split('/').pop() || '';
    if (await copyShareLinkToClipboard(token, true)) {
      setCopied(true);
      toast({ title: 'Enlace copiado', description: 'Ya puedes compartirlo por WhatsApp.' });
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setGeneratedLink(null);
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Generar enlace de reparto
          </DialogTitle>
          <DialogDescription>
            Elige un día activo. El enlace clásico se actualizará automáticamente y mantendrá el orden de ruta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!generatedLink ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="delivery-date">Próximos días de reparto</Label>
                <Select value={deliveryDate} onValueChange={setDeliveryDate} disabled={!activeDates.length}>
                  <SelectTrigger id="delivery-date">
                    <SelectValue placeholder="No hay días activos configurados" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeDates.map(date => {
                      const schedule = schedules?.find(item => item.dayOfWeek === getDay(date) && item.isActive);
                      return (
                        <SelectItem key={toDateKey(date)} value={toDateKey(date)}>
                          <span className="capitalize">{schedule?.name || 'Reparto'} · {format(date, "EEEE d 'de' MMMM", { locale: es })}</span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {selectedDate && selectedSchedule && (
                <div className="rounded-xl border bg-muted/40 p-4 space-y-2">
                  <div className="flex items-center gap-2 font-semibold capitalize">
                    <Calendar className="h-4 w-4 text-primary" />
                    {selectedSchedule.name} · {format(selectedDate, "EEEE d 'de' MMMM yyyy", { locale: es })}
                  </div>
                  <p className="text-xs text-muted-foreground capitalize">
                    Incluye las tareas de {collectionDates.map(date => format(new Date(`${date}T12:00:00`), 'EEE d MMM', { locale: es })).join(' + ')}.
                  </p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Package className="h-4 w-4" />
                    {previewLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : `${previewCount} apartamentos con servicio`}
                  </div>
                </div>
              )}

              {existingLink && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  Este día ya tiene un enlace activo. No se creará otro para evitar duplicados.
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Los enlaces permanecen activos durante {DEFAULT_EXPIRATION_DAYS} días y conservan el historial de la ruta.
              </p>
            </>
          ) : (
            <div className="space-y-3">
              <Label>Enlace generado</Label>
              <div className="flex gap-2">
                <div className="flex-1 rounded-md border bg-muted/30 px-3 py-2 text-xs font-mono truncate">{generatedLink}</div>
                <Button variant="outline" size="icon" onClick={handleCopy} aria-label="Copiar enlace">
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">Compártelo con el equipo de ruta.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          {!generatedLink ? (
            <>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleGenerate} disabled={isGenerating || !selectedDate || !selectedSchedule || !!existingLink}>
                {isGenerating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generando...</> : 'Generar enlace'}
              </Button>
            </>
          ) : (
            <div className="flex w-full justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>Cerrar</Button>
              <Button variant="outline" onClick={() => window.open(generatedLink, '_blank')}>
                <ExternalLink className="mr-2 h-4 w-4" />Abrir
              </Button>
              <Button onClick={handleCopy}>{copied ? 'Copiado' : 'Copiar'}</Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
