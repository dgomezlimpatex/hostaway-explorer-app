import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, Clock, Package, Eye, EyeOff } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ConsumptionResult {
  productName: string;
  quantity?: number;
  success: boolean;
  reason?: string;
}

interface AutoConsumptionStatusProps {
  results?: ConsumptionResult[];
  isProcessing: boolean;
  onDismiss?: () => void;
}

export function AutoConsumptionStatus({ 
  results = [], 
  isProcessing,
  onDismiss 
}: AutoConsumptionStatusProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (results.length > 0) {
      setIsOpen(true);
    }
  }, [results]);

  if (!isOpen && !isProcessing) {
    return null;
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;

  const getStatusColor = () => {
    if (isProcessing) return "default";
    if (failCount === 0) return "default";
    if (successCount === 0) return "destructive";
    return "secondary";
  };

  const getStatusIcon = () => {
    if (isProcessing) return <Clock className="h-4 w-4" />;
    if (failCount === 0) return <CheckCircle className="h-4 w-4" />;
    return <AlertCircle className="h-4 w-4" />;
  };

  const getStatusText = () => {
    if (isProcessing) return "Procesando consumo automático...";
    if (failCount === 0) return `${successCount} productos consumidos correctamente`;
    if (successCount === 0) return "Error en el consumo automático";
    return `${successCount} exitosos, ${failCount} con errores`;
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4" />
            Consumo Automático de Inventario
          </CardTitle>
          {onDismiss && !isProcessing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsOpen(false);
                onDismiss();
              }}
            >
              Cerrar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant={getStatusColor()} className="flex items-center gap-1">
            {getStatusIcon()}
            {getStatusText()}
          </Badge>
        </div>

        {results.length > 0 && (
          <Collapsible open={showDetails} onOpenChange={setShowDetails}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-auto p-0">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {showDetails ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {showDetails ? 'Ocultar detalles' : 'Ver detalles'}
                </div>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 mt-2">
              {results.map((result, index) => (
                <Alert key={index} variant={result.success ? "default" : "destructive"}>
                  <AlertDescription className="text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{result.productName}</span>
                      <div className="flex items-center gap-2">
                        {result.success ? (
                          <>
                            <span className="text-green-600">-{result.quantity}</span>
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          </>
                        ) : (
                          <>
                            <span className="text-destructive">{result.reason}</span>
                            <AlertCircle className="h-3 w-3 text-destructive" />
                          </>
                        )}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}