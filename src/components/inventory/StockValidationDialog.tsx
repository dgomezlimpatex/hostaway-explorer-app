import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { useAuth } from '@/hooks/useAuth';

interface StockValidationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  adjustmentData: {
    productName: string;
    currentQuantity: number;
    adjustmentQuantity: number;
    newQuantity: number;
    adjustmentType: string;
  };
}

export function StockValidationDialog({ 
  open, 
  onOpenChange, 
  onConfirm, 
  adjustmentData 
}: StockValidationDialogProps) {
  const [confirmationText, setConfirmationText] = useState('');
  const { userRole } = useAuth();
  
  const isLargeAdjustment = Math.abs(adjustmentData.adjustmentQuantity) > 50;
  const isNegativeStock = adjustmentData.newQuantity < 0;
  const requiresConfirmation = isLargeAdjustment || isNegativeStock;
  
  // Límites por rol
  const roleLimit = {
    'admin': Infinity,
    'manager': 500,
    'supervisor': 100,
    'cleaner': 0
  }[userRole] || 0;

  const exceedsRoleLimit = Math.abs(adjustmentData.adjustmentQuantity) > roleLimit;
  
  const expectedConfirmation = `CONFIRMAR ${adjustmentData.productName.toUpperCase()}`;
  const canProceed = !requiresConfirmation || 
    (confirmationText.toUpperCase() === expectedConfirmation && !exceedsRoleLimit);

  const handleConfirm = () => {
    if (canProceed) {
      onConfirm();
      setConfirmationText('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Validación de Ajuste de Stock
          </DialogTitle>
          <DialogDescription>
            Por favor confirma los detalles del ajuste antes de proceder.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Resumen del ajuste */}
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="font-medium">Producto:</span>
              <span>{adjustmentData.productName}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Stock actual:</span>
              <span>{adjustmentData.currentQuantity}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Ajuste:</span>
              <span className={adjustmentData.adjustmentQuantity >= 0 ? 'text-green-600' : 'text-red-600'}>
                {adjustmentData.adjustmentQuantity >= 0 ? '+' : ''}{adjustmentData.adjustmentQuantity}
              </span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-medium">Nuevo stock:</span>
              <span className="font-bold">{adjustmentData.newQuantity}</span>
            </div>
          </div>

          {/* Alertas de validación */}
          {exceedsRoleLimit && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Tu rol ({userRole}) no permite ajustes mayores a {roleLimit} unidades. 
                Contacta a un administrador para este ajuste.
              </AlertDescription>
            </Alert>
          )}

          {isNegativeStock && !exceedsRoleLimit && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Este ajuste resultará en stock negativo. Verifica que sea correcto.
              </AlertDescription>
            </Alert>
          )}

          {isLargeAdjustment && !exceedsRoleLimit && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Este es un ajuste grande ({Math.abs(adjustmentData.adjustmentQuantity)} unidades). 
                Confirma que los datos sean correctos.
              </AlertDescription>
            </Alert>
          )}

          {/* Campo de confirmación para ajustes que lo requieren */}
          {requiresConfirmation && !exceedsRoleLimit && (
            <div className="space-y-2">
              <Label htmlFor="confirmation">
                Para confirmar, escribe: <code className="bg-muted px-1 rounded">{expectedConfirmation}</code>
              </Label>
              <Input
                id="confirmation"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder="Escribe la confirmación..."
                className={confirmationText.toUpperCase() === expectedConfirmation ? 'border-green-500' : ''}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={!canProceed}
            variant={requiresConfirmation ? "destructive" : "default"}
          >
            {requiresConfirmation ? 'Confirmar Ajuste' : 'Proceder'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}