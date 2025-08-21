import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useSedes } from '@/hooks/useSedes';
import { useSede } from '@/contexts/SedeContext';
import { useAuth } from '@/hooks/useAuth';
import { CheckCircle2, XCircle, AlertCircle, TestTube } from 'lucide-react';

export const SedeTestingDashboard = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeSede, availableSedes, getActiveSedeId, hasAccessToSede } = useSede();
  const { allSedes, userSedes } = useSedes();
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});
  const [isRunningTests, setIsRunningTests] = useState(false);

  const runTest = async (testName: string, testFn: () => Promise<boolean>) => {
    setIsRunningTests(true);
    try {
      const result = await testFn();
      setTestResults(prev => ({ ...prev, [testName]: result }));
      return result;
    } catch (error) {
      console.error(`Test ${testName} failed:`, error);
      setTestResults(prev => ({ ...prev, [testName]: false }));
      return false;
    } finally {
      setIsRunningTests(false);
    }
  };

  const testSedeContext = async () => {
    return runTest('sedeContext', async () => {
      // Verificar que el contexto está funcionando
      const activeSedeId = getActiveSedeId();
      const hasActiveSede = !!activeSede;
      const hasAvailableSedes = availableSedes.length > 0;
      
      return hasActiveSede && hasAvailableSedes && !!activeSedeId;
    });
  };

  const testSedeAccess = async () => {
    return runTest('sedeAccess', async () => {
      if (!activeSede) return false;
      
      // Verificar acceso a la sede activa
      const hasAccess = hasAccessToSede(activeSede.id);
      return hasAccess;
    });
  };

  const testDataFiltering = async () => {
    return runTest('dataFiltering', async () => {
      // Verificar que userSedes están filtradas correctamente
      const userHasAccess = userSedes.length > 0;
      const allSedesCount = allSedes.length;
      const userSedesCount = userSedes.length;
      
      // Para usuarios normales, userSedes debería ser <= allSedes
      return userHasAccess && userSedesCount <= allSedesCount;
    });
  };

  const testSedeIndicators = async () => {
    return runTest('sedeIndicators', async () => {
      // Verificar que los indicadores visuales funcionan
      return !!activeSede && !!activeSede.nombre && !!activeSede.codigo;
    });
  };

  const runAllTests = async () => {
    setIsRunningTests(true);
    toast({
      title: "Ejecutando pruebas",
      description: "Verificando el sistema multi-sede...",
    });

    const results = await Promise.all([
      testSedeContext(),
      testSedeAccess(),
      testDataFiltering(),
      testSedeIndicators()
    ]);

    const passed = results.filter(Boolean).length;
    const total = results.length;

    toast({
      title: passed === total ? "Todas las pruebas pasaron" : "Algunas pruebas fallaron",
      description: `${passed}/${total} pruebas exitosas`,
      variant: passed === total ? "default" : "destructive",
    });

    setIsRunningTests(false);
  };

  const getTestIcon = (testName: string) => {
    if (!(testName in testResults)) return <TestTube className="h-4 w-4 text-muted-foreground" />;
    return testResults[testName] ? 
      <CheckCircle2 className="h-4 w-4 text-green-600" /> : 
      <XCircle className="h-4 w-4 text-red-600" />;
  };

  const getTestBadge = (testName: string) => {
    if (!(testName in testResults)) return <Badge variant="outline">Pendiente</Badge>;
    return testResults[testName] ? 
      <Badge variant="default" className="bg-green-100 text-green-800">Exitosa</Badge> : 
      <Badge variant="destructive">Fallida</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Panel de Pruebas - Sistema Multi-Sede</h2>
          <p className="text-muted-foreground">
            Herramientas para verificar el correcto funcionamiento del sistema
          </p>
        </div>
        <Button 
          onClick={runAllTests} 
          disabled={isRunningTests}
          className="bg-primary hover:bg-primary/90"
        >
          {isRunningTests ? "Ejecutando..." : "Ejecutar Todas las Pruebas"}
        </Button>
      </div>

      <Tabs defaultValue="tests" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tests">Pruebas Automáticas</TabsTrigger>
          <TabsTrigger value="status">Estado del Sistema</TabsTrigger>
          <TabsTrigger value="debug">Información de Debug</TabsTrigger>
        </TabsList>

        <TabsContent value="tests" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {getTestIcon('sedeContext')}
                  Contexto de Sede
                </CardTitle>
                {getTestBadge('sedeContext')}
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Verifica que el SedeContext está funcionando correctamente
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={testSedeContext}
                  disabled={isRunningTests}
                  className="mt-2"
                >
                  Probar
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {getTestIcon('sedeAccess')}
                  Permisos de Acceso
                </CardTitle>
                {getTestBadge('sedeAccess')}
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Verifica los permisos de acceso a la sede activa
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={testSedeAccess}
                  disabled={isRunningTests}
                  className="mt-2"
                >
                  Probar
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {getTestIcon('dataFiltering')}
                  Filtrado de Datos
                </CardTitle>
                {getTestBadge('dataFiltering')}
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Verifica que los datos se filtran correctamente por sede
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={testDataFiltering}
                  disabled={isRunningTests}
                  className="mt-2"
                >
                  Probar
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {getTestIcon('sedeIndicators')}
                  Indicadores Visuales
                </CardTitle>
                {getTestBadge('sedeIndicators')}
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Verifica que los indicadores de sede son visibles
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={testSedeIndicators}
                  disabled={isRunningTests}
                  className="mt-2"
                >
                  Probar
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Sede Activa</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {activeSede ? activeSede.nombre : "Ninguna"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {activeSede ? `Código: ${activeSede.codigo}` : "No hay sede seleccionada"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Sedes Disponibles</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{availableSedes.length}</div>
                <p className="text-xs text-muted-foreground">
                  Sedes con acceso para el usuario
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Sedes</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{allSedes.length}</div>
                <p className="text-xs text-muted-foreground">
                  Sedes activas en el sistema
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="debug" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Información de Debug</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Usuario Actual:</h4>
                <code className="bg-muted p-2 rounded block text-sm">
                  {JSON.stringify({ id: user?.id, email: user?.email }, null, 2)}
                </code>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Sede Activa:</h4>
                <code className="bg-muted p-2 rounded block text-sm">
                  {JSON.stringify(activeSede, null, 2)}
                </code>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Sedes Disponibles:</h4>
                <code className="bg-muted p-2 rounded block text-sm">
                  {JSON.stringify(availableSedes, null, 2)}
                </code>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};