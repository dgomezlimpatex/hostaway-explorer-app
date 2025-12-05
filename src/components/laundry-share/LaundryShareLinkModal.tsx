import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Copy, Check, Link, Loader2 } from 'lucide-react';
import { useLaundryShareLinks } from '@/hooks/useLaundryShareLinks';
import { copyShareLinkToClipboard, getShareLinkUrl, calculateExpirationDate, fetchLaundryTasksForDateRange } from '@/services/laundryShareService';
import { useToast } from '@/hooks/use-toast';

interface LaundryShareLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateStart: string;
  dateEnd: string;
  sedeIds?: string[];
}

type ExpirationOption = 'day' | 'week' | 'month' | 'permanent';

export const LaundryShareLinkModal = ({
  open,
  onOpenChange,
  dateStart,
  dateEnd,
  sedeIds,
}: LaundryShareLinkModalProps) => {
  const { toast } = useToast();
  const { createShareLink } = useLaundryShareLinks();
  const [expiration, setExpiration] = useState<ExpirationOption>('week');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      // Fetch current task IDs for snapshot
      const taskIds = await fetchLaundryTasksForDateRange(dateStart, dateEnd, sedeIds);
      
      const expiresAt = calculateExpirationDate(expiration);
      
      const result = await createShareLink.mutateAsync({
        dateStart,
        dateEnd,
        expiresAt,
        isPermanent: expiration === 'permanent',
        taskIds,
        filters: sedeIds ? { sedeIds } : {},
      });

      const url = getShareLinkUrl(result.token);
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
    const success = await copyShareLinkToClipboard(token);
    
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

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Generar Enlace Compartible
          </DialogTitle>
          <DialogDescription>
            Crea un enlace para que los repartidores vean la lista de lavandería sin necesidad de cuenta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Date range info */}
          <div className="rounded-lg bg-muted p-3">
            <p className="text-sm text-muted-foreground">Período seleccionado:</p>
            <p className="font-medium">
              {dateStart === dateEnd 
                ? formatDate(dateStart)
                : `${formatDate(dateStart)} - ${formatDate(dateEnd)}`
              }
            </p>
          </div>

          {!generatedLink ? (
            <>
              {/* Expiration options */}
              <div className="space-y-3">
                <Label>Duración del enlace</Label>
                <RadioGroup
                  value={expiration}
                  onValueChange={(value) => setExpiration(value as ExpirationOption)}
                  className="grid gap-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="day" id="day" />
                    <Label htmlFor="day" className="font-normal cursor-pointer">
                      24 horas
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="week" id="week" />
                    <Label htmlFor="week" className="font-normal cursor-pointer">
                      1 semana
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="month" id="month" />
                    <Label htmlFor="month" className="font-normal cursor-pointer">
                      1 mes
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="permanent" id="permanent" />
                    <Label htmlFor="permanent" className="font-normal cursor-pointer">
                      Permanente (sin expiración)
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
                Comparte este enlace con los repartidores por WhatsApp o cualquier otro medio.
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
              <Button onClick={handleGenerate} disabled={isGenerating}>
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
