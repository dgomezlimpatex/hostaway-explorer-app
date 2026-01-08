import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Check, Link, Loader2, Calendar, Truck, Package } from 'lucide-react';
import { useLaundryShareLinks } from '@/hooks/useLaundryShareLinks';
import { useDeliveryDayOptions, DeliveryDayOption } from '@/hooks/useLaundrySchedule';
import { copyShareLinkToClipboard, getShareLinkUrl, calculateExpirationDate } from '@/services/laundryShareService';
import { fetchTasksForDates } from '@/services/laundryScheduleService';
import { useToast } from '@/hooks/use-toast';
import { useSede } from '@/contexts/SedeContext';
import { format, addDays, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

interface LaundryScheduledLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ExpirationOption = 'day' | 'week' | 'month' | 'permanent';

export const LaundryScheduledLinkModal = ({
  open,
  onOpenChange,
}: LaundryScheduledLinkModalProps) => {
  const { toast } = useToast();
  const { activeSede } = useSede();
  const { createShareLink } = useLaundryShareLinks();
  const [weekOffset, setWeekOffset] = useState(0);
  const { options: deliveryOptions, isLoading: optionsLoading } = useDeliveryDayOptions(weekOffset);
  
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [expiration, setExpiration] = useState<ExpirationOption>('week');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewData, setPreviewData] = useState<{ count: number; loading: boolean }>({ count: 0, loading: false });

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setGeneratedLink(null);
      setCopied(false);
      setSelectedDayIndex(0);
      setWeekOffset(0);
    }
  }, [open]);

  // Get selected delivery option
  const selectedOption = useMemo(() => {
    return deliveryOptions[selectedDayIndex];
  }, [deliveryOptions, selectedDayIndex]);

  // Load preview data when selection changes
  useEffect(() => {
    if (!selectedOption || !activeSede?.id) return;

    const loadPreview = async () => {
      setPreviewData({ count: 0, loading: true });
      
      const dates = selectedOption.collectionDates.map(d => format(d, 'yyyy-MM-dd'));
      const tasks = await fetchTasksForDates(dates, activeSede.id);
      
      setPreviewData({ count: tasks.length, loading: false });
    };

    loadPreview();
  }, [selectedOption, activeSede?.id]);

  // Week options
  const weekOptions = useMemo(() => {
    const today = new Date();
    return [
      { value: 0, label: 'Esta semana' },
      { value: 1, label: 'Próxima semana' },
      { value: 2, label: `Semana del ${format(addDays(startOfWeek(today, { weekStartsOn: 1 }), 14), 'd MMM', { locale: es })}` },
    ];
  }, []);

  const handleGenerate = async () => {
    if (!activeSede?.id || !selectedOption) {
      toast({
        title: 'Error',
        description: 'No hay día de reparto seleccionado',
        variant: 'destructive',
      });
      return;
    }
    
    setIsGenerating(true);
    try {
      const dates = selectedOption.collectionDates.map(d => format(d, 'yyyy-MM-dd'));
      const tasks = await fetchTasksForDates(dates, activeSede.id);
      const taskIds = tasks.map(t => t.taskId);
      
      if (taskIds.length === 0) {
        toast({
          title: 'Sin tareas',
          description: 'No hay tareas de lavandería para las fechas seleccionadas',
          variant: 'destructive',
        });
        setIsGenerating(false);
        return;
      }

      const expiresAt = calculateExpirationDate(expiration);
      const dateStart = format(selectedOption.collectionDates[0], 'yyyy-MM-dd');
      const dateEnd = format(selectedOption.collectionDates[selectedOption.collectionDates.length - 1], 'yyyy-MM-dd');
      
      const result = await createShareLink.mutateAsync({
        dateStart,
        dateEnd,
        expiresAt,
        isPermanent: expiration === 'permanent',
        taskIds,
        allTaskIds: taskIds,
        sedeId: activeSede.id,
        filters: { 
          deliveryDay: selectedOption.schedule.dayOfWeek,
          collectionDates: dates,
          linkType: 'scheduled',
        },
      });

      // Use the scheduled route for scheduled links
      const url = getShareLinkUrl(result.token, true);
      setGeneratedLink(url);
    } catch (error) {
      console.error('Error generating link:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedLink) return;
    
    const token = generatedLink.split('/').pop() || '';
    const success = await copyShareLinkToClipboard(token, true);
    
    if (success) {
      setCopied(true);
      toast({
        title: 'Enlace copiado',
        description: 'Ya puedes compartirlo por WhatsApp u otro medio',
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setGeneratedLink(null);
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Generar Enlace de Reparto
          </DialogTitle>
          <DialogDescription>
            Crea un enlace para que el repartidor vea qué ropa recoger y entregar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {!generatedLink ? (
            <>
              {/* Week selector */}
              <div className="space-y-2">
                <Label>Semana</Label>
                <Select 
                  value={weekOffset.toString()} 
                  onValueChange={(v) => {
                    setWeekOffset(parseInt(v));
                    setSelectedDayIndex(0);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {weekOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value.toString()}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Delivery day selector */}
              <div className="space-y-3">
                <Label>Día de reparto</Label>
                {optionsLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando días...
                  </div>
                ) : deliveryOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No hay días de reparto configurados
                  </p>
                ) : (
                  <RadioGroup
                    value={selectedDayIndex.toString()}
                    onValueChange={(v) => setSelectedDayIndex(parseInt(v))}
                    className="grid gap-2"
                  >
                    {deliveryOptions.map((option, index) => (
                      <div
                        key={index}
                        className="flex items-center space-x-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setSelectedDayIndex(index)}
                      >
                        <RadioGroupItem value={index.toString()} id={`day-${index}`} />
                        <div className="flex-1">
                          <Label 
                            htmlFor={`day-${index}`} 
                            className="font-medium cursor-pointer"
                          >
                            {option.label}
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            {option.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </RadioGroup>
                )}
              </div>

              {/* Preview */}
              {selectedOption && (
                <div className="rounded-lg bg-muted p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="font-medium">
                      Reparto: {format(selectedOption.deliveryDate, "EEEE d 'de' MMMM", { locale: es })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Package className="h-4 w-4" />
                    {previewData.loading ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Calculando...
                      </span>
                    ) : (
                      <span>{previewData.count} apartamentos con servicio</span>
                    )}
                  </div>
                </div>
              )}

              {/* Expiration options */}
              <div className="space-y-3">
                <Label>Duración del enlace</Label>
                <RadioGroup
                  value={expiration}
                  onValueChange={(value) => setExpiration(value as ExpirationOption)}
                  className="grid grid-cols-2 gap-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="day" id="exp-day" />
                    <Label htmlFor="exp-day" className="font-normal cursor-pointer">
                      24 horas
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="week" id="exp-week" />
                    <Label htmlFor="exp-week" className="font-normal cursor-pointer">
                      1 semana
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="month" id="exp-month" />
                    <Label htmlFor="exp-month" className="font-normal cursor-pointer">
                      1 mes
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="permanent" id="exp-permanent" />
                    <Label htmlFor="exp-permanent" className="font-normal cursor-pointer">
                      Permanente
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </>
          ) : (
            /* Generated link display */
            <div className="space-y-3">
              <Label>Enlace generado</Label>
              <div className="flex gap-2">
                <Input
                  value={generatedLink}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Comparte este enlace con el repartidor por WhatsApp o cualquier otro medio.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {!generatedLink ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button 
                onClick={handleGenerate} 
                disabled={isGenerating || !selectedOption || previewData.count === 0}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  'Generar Enlace'
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cerrar
              </Button>
              <Button onClick={handleCopy}>
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar Enlace
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
