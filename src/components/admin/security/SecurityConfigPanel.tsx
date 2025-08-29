import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Settings, 
  Lock,
  Key,
  Clock,
  Database,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

interface SecurityIssue {
  id: string;
  level: 'ERROR' | 'WARN';
  title: string;
  description: string;
  category: string;
  fixUrl?: string;
  status: 'pending' | 'fixed' | 'acknowledged';
}

export const SecurityConfigPanel = () => {
  const [securityIssues] = useState<SecurityIssue[]>([
    {
      id: 'security_definer_view',
      level: 'ERROR',
      title: 'Security Definer View Detectada',
      description: 'Se ha detectado una vista con propiedad SECURITY DEFINER que puede comprometer la seguridad.',
      category: 'DATABASE',
      fixUrl: 'https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view',
      status: 'pending'
    },
    {
      id: 'otp_long_expiry',
      level: 'WARN',
      title: 'OTP con Expiración Prolongada',
      description: 'El tiempo de expiración de OTP excede el umbral recomendado de seguridad.',
      category: 'AUTH',
      fixUrl: 'https://supabase.com/docs/guides/platform/going-into-prod#security',
      status: 'pending'
    },
    {
      id: 'leaked_password_protection',
      level: 'WARN',
      title: 'Protección de Contraseñas Filtradas Deshabilitada',
      description: 'La protección contra contraseñas comprometidas está actualmente deshabilitada.',
      category: 'AUTH',
      fixUrl: 'https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection',
      status: 'pending'
    }
  ]);

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'ERROR':
        return <AlertTriangle className="w-4 h-4 text-destructive" />;
      case 'WARN':
        return <Shield className="w-4 h-4 text-warning" />;
      default:
        return <CheckCircle className="w-4 h-4 text-success" />;
    }
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'ERROR':
        return <Badge variant="destructive">Crítico</Badge>;
      case 'WARN':
        return <Badge variant="secondary">Advertencia</Badge>;
      default:
        return <Badge variant="default">Info</Badge>;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'DATABASE':
        return <Database className="w-4 h-4" />;
      case 'AUTH':
        return <Lock className="w-4 h-4" />;
      default:
        return <Settings className="w-4 h-4" />;
    }
  };

  const handleOpenFix = (url: string) => {
    window.open(url, '_blank');
  };

  const errorIssues = securityIssues.filter(issue => issue.level === 'ERROR');
  const warnIssues = securityIssues.filter(issue => issue.level === 'WARN');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Configuración de Seguridad</h2>
          <p className="text-muted-foreground">
            Gestiona la configuración de seguridad y corrige problemas detectados
          </p>
        </div>
      </div>

      {/* Resumen de estado */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Problemas Críticos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{errorIssues.length}</div>
            <p className="text-xs text-muted-foreground">Requieren atención inmediata</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Advertencias</CardTitle>
            <Shield className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{warnIssues.length}</div>
            <p className="text-xs text-muted-foreground">Mejoras recomendadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estado General</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {errorIssues.length === 0 ? 'Seguro' : 'En Riesgo'}
            </div>
            <p className="text-xs text-muted-foreground">
              {errorIssues.length === 0 ? 'Sin problemas críticos' : 'Acción requerida'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="issues" className="space-y-4">
        <TabsList>
          <TabsTrigger value="issues">Problemas de Seguridad</TabsTrigger>
          <TabsTrigger value="config">Configuración</TabsTrigger>
          <TabsTrigger value="recommendations">Recomendaciones</TabsTrigger>
        </TabsList>

        <TabsContent value="issues" className="space-y-4">
          {errorIssues.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Se han detectado {errorIssues.length} problema(s) crítico(s) que requieren atención inmediata.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            {securityIssues.map((issue) => (
              <Card key={issue.id} className={issue.level === 'ERROR' ? 'border-destructive' : ''}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getLevelIcon(issue.level)}
                      <CardTitle className="text-lg">{issue.title}</CardTitle>
                      {getLevelBadge(issue.level)}
                    </div>
                    <div className="flex items-center space-x-2">
                      {getCategoryIcon(issue.category)}
                      <Badge variant="outline">{issue.category}</Badge>
                    </div>
                  </div>
                  <CardDescription>{issue.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Estado: {issue.status === 'pending' ? 'Pendiente' : 'Resuelto'}
                      </span>
                    </div>
                    {issue.fixUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenFix(issue.fixUrl!)}
                        className="text-xs"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Ver Solución
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Key className="w-5 h-5" />
                <span>Configuración de Autenticación</span>
              </CardTitle>
              <CardDescription>
                Configura los parámetros de seguridad de autenticación en Supabase
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Settings className="h-4 w-4" />
                <AlertDescription>
                  Para configurar estos ajustes, ve al Dashboard de Supabase → Authentication → Settings
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-medium">OTP Expiry Time</h4>
                    <p className="text-sm text-muted-foreground">
                      Reducir a 5-10 minutos para mayor seguridad
                    </p>
                  </div>
                  <Badge variant="secondary">Manual</Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Password Protection</h4>
                    <p className="text-sm text-muted-foreground">
                      Habilitar protección contra contraseñas filtradas
                    </p>
                  </div>
                  <Badge variant="secondary">Manual</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Configuración de Producción</CardTitle>
                <CardDescription>
                  Ajustes recomendados para un entorno de producción seguro
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li>• OTP Expiry: 5-10 minutos máximo</li>
                  <li>• Password protection habilitada</li>
                  <li>• Rate limiting configurado</li>
                  <li>• HTTPS obligatorio</li>
                  <li>• Logs de auditoría activados</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Monitoreo Continuo</CardTitle>
                <CardDescription>
                  Prácticas para mantener la seguridad a largo plazo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li>• Revisar logs de seguridad semanalmente</li>
                  <li>• Ejecutar linter de seguridad mensualmente</li>
                  <li>• Actualizar funciones regularmemente</li>
                  <li>• Revisar políticas RLS periódicamente</li>
                  <li>• Auditar accesos de usuarios</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};