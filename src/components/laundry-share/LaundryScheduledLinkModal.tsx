import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Copy, Check, Loader2, Calendar, Truck, Package, ExternalLink } from 'lucide-react';
import { useLaundryShareLinks } from '@/hooks/useLaundryShareLinks';
import { copyShareLinkToClipboard, getShareLinkUrl } from '@/services/laundryShareService';
import { fetchTasksForDates } from '@/services/laundryScheduleService';
import { useToast } from '@/hooks/use-toast';
import { useSede } from '@/contexts/SedeContext';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface LaundryScheduledLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedDate?: Date;
}

// Default link duration (días)
const DEFAULT_EXPIRATION_DAYS = 30;

export const LaundryScheduledLinkModal = ({
  open,
  onOpenChange,
  preselectedDate,
}: LaundryScheduledLinkModalProps) => {
  const { toast } = useToast();
  const { activeSede } = useSede();
  const { createShareLink } = useLaundryShareLinks();

  const [deliveryDate, setDeliveryDate] = useState<string>(() =>
    format(preselectedDate || new Date(), 'yyyy-MM-dd')
  );
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewData, setPreviewData] = useState<{ count: number; loading: boolean }>({ count: 0, loading: false });

  const lastFetchKey = useRef<string>('');

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setGeneratedLink(null);
      setCopied(false);
      setPreviewData({ count: 0, loading: false });
      lastFetchKey.current = '';
      setDeliveryDate(format(preselectedDate || new Date(), 'yyyy-MM-dd'));
    }
  }, [open, preselectedDate]);

  // Load preview count when date changes
  useEffect(() => {
    if (!deliveryDate || !activeSede?.id || !open) return;

    const fetchKey = `${deliveryDate}-${activeSede.id}`;
    if (fetchKey === lastFetchKey.current) return;
    lastFetchKey.current = fetchKey;

    const loadPreview = async () => {
      setPreviewData({ count: 0, loading: true });
      try {
        const tasks = await fetchTasksForDates([deliveryDate], activeSede.id);
        setPreviewData({ count: tasks.length, loading: false });
      } catch (error) {
        console.error('Error loading preview:', error);
        setPreviewData({ count: 0, loading: false });
      }
    };

    loadPreview();
  }, [deliveryDate, activeSede?.id, open]);

  const handleGenerate = async () => {
    if (!activeSede?.id || !deliveryDate) {
      toast({
        title: 'Error',
        description: 'No hay fecha de reparto seleccionada',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const tasks = await fetchTasksForDates([deliveryDate], activeSede.id);
      const taskIds = tasks.map(t => t.taskId);

      if (taskIds.length === 0) {
        toast({
          title: 'Sin tareas',
          description: 'No hay tareas de lavandería para la fecha seleccionada',
          variant: 'destructive',
        });
        setIsGenerating(false);
        return;
      }

      const expiresAt = addDays(new Date(), DEFAULT_EXPIRATION_DAYS).toISOString();

      const result = await createShareLink.mutateAsync({
        dateStart: deliveryDate,
        dateEnd: deliveryDate,
        expiresAt,
        isPermanent: false,
        taskIds,
        allTaskIds: taskIds,
        sedeId: activeSede.id,
        linkType: 'scheduled',
        filters: {
          collectionDates: [deliveryDate],
        },
      });

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

  const parsedDate = deliveryDate ? new Date(deliveryDate + 'T00:00:00') : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
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
              {/* Date picker */}
              <div className="space-y-2">
                <Label htmlFor="delivery-date">Fecha de reparto</Label>
                <Input
                  id="delivery-date"
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              </div>

              {/* Preview */}
              {parsedDate && (
                <div className="rounded-lg bg-muted p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="font-medium capitalize">
                      {format(parsedDate, "EEEE d 'de' MMMM yyyy", { locale: es })}
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

              <p className="text-xs text-muted-foreground">
                El enlace estará activo durante {DEFAULT_EXPIRATION_DAYS} días.
              </p>
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
                disabled={isGenerating || !deliveryDate || previewData.count === 0}
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
            <div className="flex items-center gap-2 w-full justify-end">
              <Button variant="outline" onClick={handleClose}>
                Cerrar
              </Button>
              <Button
                variant="outline"
                onClick={() => generatedLink && window.open(generatedLink, '_blank')}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Abrir
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
                    Copiar
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
