import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Copy, X, Bug, Info, Clock, Smartphone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface MobileError {
  id: string;
  timestamp: string;
  type: 'upload' | 'incident' | 'save' | 'network' | 'general';
  title: string;
  message: string;
  details?: any;
  context?: any;
  stackTrace?: string;
  userAction?: string;
  deviceInfo?: any;
}

interface MobileErrorDisplayProps {
  errors: MobileError[];
  onDismiss: (errorId: string) => void;
  onDismissAll: () => void;
}

const ErrorTypeIcon = ({ type }: { type: MobileError['type'] }) => {
  switch (type) {
    case 'upload': return <span className="text-blue-600">📷</span>;
    case 'incident': return <span className="text-orange-600">⚠️</span>;
    case 'save': return <span className="text-red-600">💾</span>;
    case 'network': return <span className="text-purple-600">📶</span>;
    default: return <span className="text-gray-600">❌</span>;
  }
};

const ErrorTypeBadge = ({ type }: { type: MobileError['type'] }) => {
  const variants = {
    upload: 'bg-blue-100 text-blue-800',
    incident: 'bg-orange-100 text-orange-800', 
    save: 'bg-red-100 text-red-800',
    network: 'bg-purple-100 text-purple-800',
    general: 'bg-gray-100 text-gray-800'
  };

  const labels = {
    upload: 'Subida de Fotos',
    incident: 'Incidencias',
    save: 'Guardar Reporte', 
    network: 'Conexión',
    general: 'General'
  };

  return (
    <Badge className={variants[type]}>
      {labels[type]}
    </Badge>
  );
};

export const MobileErrorDisplay: React.FC<MobileErrorDisplayProps> = ({
  errors,
  onDismiss,
  onDismissAll
}) => {
  const { toast } = useToast();
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());

  const toggleExpanded = (errorId: string) => {
    const newExpanded = new Set(expandedErrors);
    if (newExpanded.has(errorId)) {
      newExpanded.delete(errorId);
    } else {
      newExpanded.add(errorId);
    }
    setExpandedErrors(newExpanded);
  };

  const copyErrorToClipboard = async (error: MobileError) => {
    const errorText = `
🚨 ERROR REPORTE LIMPIEZA
══════════════════════════
📱 Tipo: ${error.type}
📋 Título: ${error.title}
💬 Mensaje: ${error.message}
🕐 Fecha/Hora: ${format(new Date(error.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: es })}
📱 Acción del usuario: ${error.userAction || 'No especificada'}

📊 DETALLES TÉCNICOS:
${error.details ? JSON.stringify(error.details, null, 2) : 'No disponibles'}

🔍 CONTEXTO:
${error.context ? JSON.stringify(error.context, null, 2) : 'No disponible'}

📱 INFO DEL DISPOSITIVO:
${error.deviceInfo ? JSON.stringify(error.deviceInfo, null, 2) : 'No disponible'}

═══════════════════════════
ID Error: ${error.id}
Generado automáticamente por sistema de reportes
    `.trim();

    try {
      await navigator.clipboard.writeText(errorText);
      toast({
        title: "Error copiado ✅",
        description: "Envía este texto al administrador por WhatsApp",
      });
    } catch (e) {
      // Fallback para dispositivos que no soporten clipboard
      console.log('Error details for screenshot:', errorText);
      toast({
        title: "📸 Haz captura de pantalla",
        description: "El error se muestra en consola. Haz captura de esta pantalla y envíala al administrador.",
        duration: 8000
      });
    }
  };

  if (errors.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <Card className="w-full max-w-md max-h-[80vh] overflow-hidden">
        <CardHeader className="bg-red-50 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <CardTitle className="text-red-800">
                Errores del Sistema ({errors.length})
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismissAll}
              className="text-red-600 hover:bg-red-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="bg-yellow-100 border border-yellow-300 rounded p-2 text-sm">
            <div className="flex items-center gap-2 text-yellow-800">
              <Info className="h-4 w-4" />
              <span className="font-medium">Para el Administrador:</span>
            </div>
            <p className="text-yellow-700 mt-1">
              Toca "Copiar Error" y envía la información por WhatsApp
            </p>
          </div>
        </CardHeader>

        <CardContent className="p-0 max-h-[50vh] overflow-y-auto">
          {errors.map((error) => (
            <div key={error.id} className="border-b last:border-b-0">
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ErrorTypeIcon type={error.type} />
                    <span className="font-medium text-sm">{error.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ErrorTypeBadge type={error.type} />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDismiss(error.id)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <p className="text-sm text-gray-600 mb-2">{error.message}</p>

                <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                  <Clock className="h-3 w-3" />
                  {format(new Date(error.timestamp), 'dd/MM/yyyy HH:mm', { locale: es })}
                  {error.userAction && (
                    <>
                      <span>•</span>
                      <span>Acción: {error.userAction}</span>
                    </>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyErrorToClipboard(error)}
                    className="text-xs flex-1"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copiar Error
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpanded(error.id)}
                    className="text-xs"
                  >
                    <Bug className="h-3 w-3 mr-1" />
                    {expandedErrors.has(error.id) ? 'Menos' : 'Más'}
                  </Button>
                </div>

                {expandedErrors.has(error.id) && (
                  <div className="mt-3 p-2 bg-gray-50 rounded text-xs font-mono">
                    <div className="text-gray-700 space-y-1">
                      <div><strong>ID:</strong> {error.id}</div>
                      {error.details && (
                        <div>
                          <strong>Detalles:</strong>
                          <pre className="text-xs mt-1 whitespace-pre-wrap">
                            {JSON.stringify(error.details, null, 2)}
                          </pre>
                        </div>
                      )}
                      {error.context && (
                        <div>
                          <strong>Contexto:</strong>
                          <pre className="text-xs mt-1 whitespace-pre-wrap">
                            {JSON.stringify(error.context, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </CardContent>

        <div className="p-4 bg-gray-50 border-t">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Smartphone className="h-3 w-3" />
            <span>Sistema de errores para móviles activo</span>
          </div>
        </div>
      </Card>
    </div>
  );
};