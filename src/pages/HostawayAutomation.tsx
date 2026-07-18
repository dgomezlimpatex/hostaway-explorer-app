import { Archive, ArrowLeft, LockKeyhole } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const HostawayAutomation = () => {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto max-w-4xl p-4 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold">Hostaway</h1>
            <Badge variant="secondary">Integración desactivada</Badge>
          </div>
          <p className="text-muted-foreground">
            Integración conservada para futuros clientes que trabajen con Hostaway.
          </p>
        </div>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LockKeyhole className="h-5 w-5" />
            Sin actividad operativa
          </CardTitle>
          <CardDescription>
            Limpatex no utiliza Hostaway actualmente. Las sincronizaciones manuales,
            automáticas y la gestión de horarios están bloqueadas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
            Se conservan el código, las tablas y los logs históricos. Para activar esta
            integración en el futuro será necesario un proceso controlado de configuración,
            pruebas E2E y autorización expresa.
          </div>
          <Button variant="outline" onClick={() => navigate('/hostaway-sync-logs')} className="gap-2">
            <Archive className="h-4 w-4" />
            Consultar historial archivado
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default HostawayAutomation;
