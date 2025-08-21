import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SedeTestingDashboard } from '@/components/admin/sede/SedeTestingDashboard';
import { SedeValidationPanel } from '@/components/admin/sede/SedeValidationPanel';

const SedeTestingPage = () => {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Centro de Pruebas Multi-Sede</h1>
        <p className="text-muted-foreground">
          Herramientas para testing y validación del sistema multi-sede
        </p>
      </div>

      <Tabs defaultValue="testing" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="testing">Pruebas Automáticas</TabsTrigger>
          <TabsTrigger value="validation">Validación de Integridad</TabsTrigger>
        </TabsList>

        <TabsContent value="testing">
          <SedeTestingDashboard />
        </TabsContent>

        <TabsContent value="validation">
          <SedeValidationPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SedeTestingPage;