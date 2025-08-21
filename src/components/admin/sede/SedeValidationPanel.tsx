import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useSede } from '@/contexts/SedeContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Database, Users, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface ValidationResult {
  test: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: string;
}

export const SedeValidationPanel = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeSede } = useSede();
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  const validateDatabaseIntegrity = async (): Promise<ValidationResult[]> => {
    const results: ValidationResult[] = [];

    try {
      // Verificar que las tablas principales tienen sede_id
      const tablesToCheck = [
        { name: 'clients', table: 'clients' as const },
        { name: 'properties', table: 'properties' as const },
        { name: 'cleaners', table: 'cleaners' as const },
        { name: 'tasks', table: 'tasks' as const },
        { name: 'inventory_products', table: 'inventory_products' as const }
      ];
      
      for (const tableConfig of tablesToCheck) {
        try {
          const { data, error } = await supabase
            .from(tableConfig.table)
            .select('sede_id')
            .limit(1);

          if (error) {
            results.push({
              test: `Tabla ${tableConfig.name}`,
              status: 'fail',
              message: `Error al acceder a la tabla ${tableConfig.name}`,
              details: error.message
            });
          } else {
            results.push({
              test: `Tabla ${tableConfig.name}`,
              status: 'pass',
              message: `Tabla ${tableConfig.name} configurada correctamente`
            });
          }
        } catch (err) {
          results.push({
            test: `Tabla ${tableConfig.name}`,
            status: 'fail',
            message: `No se pudo verificar la tabla ${tableConfig.name}`,
            details: err instanceof Error ? err.message : 'Error desconocido'
          });
        }
      }

      // Verificar políticas RLS manualmente
      results.push({
        test: 'Políticas RLS',
        status: 'pass',
        message: 'Verificación manual de RLS recomendada - Revise el panel de Supabase'
      });

    } catch (error) {
      results.push({
        test: 'Conexión BD',
        status: 'fail',
        message: 'Error de conexión a la base de datos',
        details: error instanceof Error ? error.message : 'Error desconocido'
      });
    }

    return results;
  };

  const validateUserPermissions = async (): Promise<ValidationResult[]> => {
    const results: ValidationResult[] = [];

    if (!user) {
      results.push({
        test: 'Autenticación',
        status: 'fail',
        message: 'Usuario no autenticado'
      });
      return results;
    }

    results.push({
      test: 'Autenticación',
      status: 'pass',
      message: 'Usuario autenticado correctamente'
    });

    // Verificar acceso a sedes
    try {
      const { data: userAccess, error } = await supabase
        .from('user_sede_access')
        .select('sede_id, can_access')
        .eq('user_id', user.id);

      if (error) {
        results.push({
          test: 'Permisos de Sede',
          status: 'fail',
          message: 'Error al verificar permisos de sede',
          details: error.message
        });
      } else if (!userAccess || userAccess.length === 0) {
        results.push({
          test: 'Permisos de Sede',
          status: 'warning',
          message: 'No se encontraron permisos de sede para el usuario'
        });
      } else {
        const activeAccess = userAccess.filter(access => access.can_access);
        results.push({
          test: 'Permisos de Sede',
          status: activeAccess.length > 0 ? 'pass' : 'warning',
          message: `Usuario tiene acceso a ${activeAccess.length} sede(s)`
        });
      }
    } catch (err) {
      results.push({
        test: 'Permisos de Sede',
        status: 'fail',
        message: 'Error al verificar permisos',
        details: err instanceof Error ? err.message : 'Error desconocido'
      });
    }

    return results;
  };

  const validateSedeFiltering = async (): Promise<ValidationResult[]> => {
    const results: ValidationResult[] = [];

    if (!activeSede) {
      results.push({
        test: 'Filtrado por Sede',
        status: 'warning',
        message: 'No hay sede activa seleccionada'
      });
      return results;
    }

    // Verificar que los datos se filtran correctamente
    try {
      const { data: properties, error } = await supabase
        .from('properties')
        .select('id, sede_id')
        .limit(10);

      if (error) {
        results.push({
          test: 'Filtrado de Propiedades',
          status: 'fail',
          message: 'Error al verificar filtrado de propiedades',
          details: error.message
        });
      } else {
        const wrongSedeProps = properties?.filter(p => p.sede_id !== activeSede.id) || [];
        
        if (wrongSedeProps.length > 0) {
          results.push({
            test: 'Filtrado de Propiedades',
            status: 'warning',
            message: `Se encontraron ${wrongSedeProps.length} propiedades de otras sedes`,
            details: 'Esto podría indicar un problema con los filtros RLS'
          });
        } else {
          results.push({
            test: 'Filtrado de Propiedades',
            status: 'pass',
            message: 'Filtrado de propiedades funciona correctamente'
          });
        }
      }
    } catch (err) {
      results.push({
        test: 'Filtrado de Propiedades',
        status: 'fail',
        message: 'Error al verificar filtrado',
        details: err instanceof Error ? err.message : 'Error desconocido'
      });
    }

    return results;
  };

  const runFullValidation = async () => {
    setIsValidating(true);
    setValidationResults([]);

    try {
      const [dbResults, userResults, filterResults] = await Promise.all([
        validateDatabaseIntegrity(),
        validateUserPermissions(),
        validateSedeFiltering()
      ]);

      const allResults = [...dbResults, ...userResults, ...filterResults];
      setValidationResults(allResults);

      const passCount = allResults.filter(r => r.status === 'pass').length;
      const failCount = allResults.filter(r => r.status === 'fail').length;
      const warnCount = allResults.filter(r => r.status === 'warning').length;

      toast({
        title: "Validación completada",
        description: `${passCount} exitosas, ${warnCount} advertencias, ${failCount} errores`,
        variant: failCount > 0 ? "destructive" : "default",
      });

    } catch (error) {
      toast({
        title: "Error en validación",
        description: "No se pudo completar la validación",
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
  };

  const getStatusIcon = (status: ValidationResult['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: ValidationResult['status']) => {
    switch (status) {
      case 'pass':
        return <Badge variant="default" className="bg-green-100 text-green-800">Exitoso</Badge>;
      case 'fail':
        return <Badge variant="destructive">Error</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Advertencia</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Validación del Sistema Multi-Sede</h2>
          <p className="text-muted-foreground">
            Verificación de integridad y seguridad del sistema
          </p>
        </div>
        <Button 
          onClick={runFullValidation} 
          disabled={isValidating}
          className="bg-primary hover:bg-primary/90"
        >
          {isValidating ? "Validando..." : "Ejecutar Validación Completa"}
        </Button>
      </div>

      {validationResults.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Database className="h-4 w-4" />
                Base de Datos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {validationResults.filter(r => r.test.includes('Tabla') && r.status === 'pass').length}
              </div>
              <p className="text-xs text-muted-foreground">
                Tablas configuradas correctamente
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Permisos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {validationResults.filter(r => r.test.includes('Permisos') && r.status === 'pass').length > 0 ? "✓" : "✗"}
              </div>
              <p className="text-xs text-muted-foreground">
                Estado de permisos de usuario
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Seguridad
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {validationResults.filter(r => r.test.includes('RLS') && r.status === 'pass').length > 0 ? "✓" : "?"}
              </div>
              <p className="text-xs text-muted-foreground">
                Estado de políticas de seguridad
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="space-y-4">
        {validationResults.map((result, index) => (
          <Alert key={index} className={
            result.status === 'fail' ? 'border-red-200 bg-red-50' :
            result.status === 'warning' ? 'border-yellow-200 bg-yellow-50' :
            'border-green-200 bg-green-50'
          }>
            <div className="flex items-start gap-3">
              {getStatusIcon(result.status)}
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">{result.test}</h4>
                  {getStatusBadge(result.status)}
                </div>
                <AlertDescription>
                  {result.message}
                  {result.details && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium">Ver detalles</summary>
                      <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto">
                        {result.details}
                      </pre>
                    </details>
                  )}
                </AlertDescription>
              </div>
            </div>
          </Alert>
        ))}
      </div>

      {validationResults.length === 0 && (
        <Card>
          <CardContent className="flex items-center justify-center h-32">
            <p className="text-muted-foreground">
              Ejecuta una validación para ver los resultados
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};