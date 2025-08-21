import { SedeAuditDashboard } from '@/components/admin/sede/SedeAuditDashboard';
import { AppHeader } from '@/components/layout/AppHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SedeTestingDashboard } from '@/components/admin/sede/SedeTestingDashboard';
import { SedeValidationPanel } from '@/components/admin/sede/SedeValidationPanel';

const SedeAuditPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Auditoría y Monitoreo - Sedes" />
      
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Centro de Monitoreo Multi-Sede</h1>
          <p className="text-muted-foreground">
            Auditoría, testing y validación del sistema multi-sede
          </p>
        </div>

        <Tabs defaultValue="audit" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="audit">Auditoría de Seguridad</TabsTrigger>
            <TabsTrigger value="testing">Pruebas Automáticas</TabsTrigger>
            <TabsTrigger value="validation">Validación de Integridad</TabsTrigger>
          </TabsList>

          <TabsContent value="audit">
            <SedeAuditDashboard />
          </TabsContent>

          <TabsContent value="testing">
            <SedeTestingDashboard />
          </TabsContent>

          <TabsContent value="validation">
            <SedeValidationPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SedeAuditPage;