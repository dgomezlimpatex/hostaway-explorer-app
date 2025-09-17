import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Bug, 
  Smartphone, 
  Wifi, 
  WifiOff, 
  Upload, 
  AlertTriangle, 
  Save, 
  Network,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';
import { useDeviceType } from '@/hooks/use-mobile';
import { useMobileErrorHandler } from '@/hooks/useMobileErrorHandler';
import { mobileErrorTester } from '@/utils/mobileErrorTester';
import { useEffect } from 'react';

export const MobileDebugPanel: React.FC = () => {
  const { isMobile } = useDeviceType();
  const errorHandler = useMobileErrorHandler();
  const [isVisible, setIsVisible] = useState(false);
  const [stats, setStats] = useState(errorHandler.getErrorStats());

  // Configurar tester con handler actual
  useEffect(() => {
    mobileErrorTester.setErrorHandler(errorHandler);
  }, [errorHandler]);

  // Actualizar stats periódicamente
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(errorHandler.getErrorStats());
    }, 1000);
    return () => clearInterval(interval);
  }, [errorHandler]);

  // Solo mostrar en móvil
  if (!isMobile) return null;

  const testButtons = [
    {
      type: 'upload' as const,
      label: 'Subida Foto',
      icon: Upload,
      color: 'bg-blue-100 text-blue-800',
      action: () => mobileErrorTester.testErrorByType('upload')
    },
    {
      type: 'incident' as const,
      label: 'Incidencia',
      icon: AlertTriangle,
      color: 'bg-orange-100 text-orange-800',
      action: () => mobileErrorTester.testErrorByType('incident')
    },
    {
      type: 'save' as const,
      label: 'Guardar',
      icon: Save,
      color: 'bg-red-100 text-red-800',
      action: () => mobileErrorTester.testErrorByType('save')
    },
    {
      type: 'network' as const,
      label: 'Red',
      icon: Network,
      color: 'bg-purple-100 text-purple-800',
      action: () => mobileErrorTester.testErrorByType('network')
    }
  ];

  return (
    <>
      {/* Botón flotante para mostrar/ocultar panel */}
      <div className="fixed bottom-4 left-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsVisible(!isVisible)}
          className="rounded-full w-12 h-12 p-0 shadow-lg border-2"
        >
          <Bug className="h-5 w-5" />
        </Button>
      </div>

      {/* Panel de debug */}
      {isVisible && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center p-4 z-40 backdrop-blur-sm">
          <Card className="w-full max-w-md max-h-[70vh] overflow-auto">
            <CardHeader className="bg-gray-50 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  <CardTitle className="text-lg">Panel de Debug Móvil</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsVisible(false)}
                >
                  <EyeOff className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {/* Estadísticas */}
              <div className="grid grid-cols-2 gap-2">
                <div className="text-center p-2 bg-blue-50 rounded">
                  <div className="text-xl font-bold text-blue-800">{stats.total}</div>
                  <div className="text-xs text-blue-600">Total Errores</div>
                </div>
                <div className="text-center p-2 bg-orange-50 rounded">
                  <div className="text-xl font-bold text-orange-800">{stats.recent}</div>
                  <div className="text-xs text-orange-600">Últimos 5min</div>
                </div>
              </div>

              {/* Estado de conexión */}
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm font-medium">Conexión:</span>
                <div className="flex items-center gap-1">
                  {navigator.onLine ? (
                    <>
                      <Wifi className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-600">Online</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-4 w-4 text-red-600" />
                      <span className="text-sm text-red-600">Offline</span>
                    </>
                  )}
                </div>
              </div>

              {/* Botones de prueba */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Probar Errores:</h4>
                <div className="grid grid-cols-2 gap-2">
                  {testButtons.map((button) => (
                    <Button
                      key={button.type}
                      variant="outline"
                      size="sm"
                      onClick={button.action}
                      className="text-xs h-auto py-2 px-2 flex flex-col gap-1"
                    >
                      <button.icon className="h-4 w-4" />
                      <span>{button.label}</span>
                      {stats.byType[button.type] > 0 && (
                        <Badge className={`text-xs ${button.color}`}>
                          {stats.byType[button.type]}
                        </Badge>
                      )}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Acciones rápidas */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Acciones:</h4>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => mobileErrorTester.testAllErrors()}
                    className="flex-1 text-xs"
                  >
                    Probar Todos
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => mobileErrorTester.clearAllErrors()}
                    className="flex-1 text-xs"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Limpiar
                  </Button>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => mobileErrorTester.testErrorStorm()}
                  className="w-full text-xs"
                >
                  ⚡ Tormenta de Errores
                </Button>
              </div>

              {/* Info del dispositivo */}
              <div className="text-xs text-gray-500 space-y-1">
                <div>User Agent: {navigator.userAgent.substring(0, 50)}...</div>
                <div>Resolución: {screen.width}×{screen.height}</div>
                <div>Ventana: {window.innerWidth}×{window.innerHeight}</div>
              </div>

              {/* Instrucciones */}
              <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
                <div className="text-xs text-yellow-800">
                  <strong>💡 Cómo usar:</strong><br/>
                  1. Toca los botones de prueba<br/>
                  2. Observa los errores en pantalla<br/>
                  3. Prueba copiar error para enviar<br/>
                  4. También disponible en consola: <code>mobileErrorTester</code>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
};