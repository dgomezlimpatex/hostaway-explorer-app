
import { useState } from 'react';
import { Copy, ExternalLink, RefreshCw, Eye, EyeOff, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  useClientPortalAccess,
  useCreatePortalAccess,
  useRegeneratePin,
  useTogglePortalStatus,
} from '@/hooks/useClientPortal';

interface ClientPortalSectionProps {
  clientId: string;
  clientName: string;
}

export const ClientPortalSection = ({ clientId, clientName }: ClientPortalSectionProps) => {
  const { toast } = useToast();
  const [showPin, setShowPin] = useState(false);
  
  const { data: portalAccess, isLoading } = useClientPortalAccess(clientId);
  const createAccess = useCreatePortalAccess();
  const regeneratePin = useRegeneratePin();
  const toggleStatus = useTogglePortalStatus();

  const baseUrl = window.location.origin;
  const portalUrl = portalAccess ? `${baseUrl}/portal/${portalAccess.portalToken}` : '';

  const handleCreateAccess = () => {
    createAccess.mutate(clientId, {
      onSuccess: (data) => {
        toast({
          title: 'Portal activado',
          description: `PIN generado: ${data.access_pin}`,
        });
      },
      onError: () => {
        toast({
          title: 'Error',
          description: 'No se pudo crear el acceso al portal',
          variant: 'destructive',
        });
      },
    });
  };

  const handleRegeneratePin = () => {
    if (!portalAccess) return;
    regeneratePin.mutate(portalAccess.id, {
      onSuccess: (newPin) => {
        toast({
          title: 'PIN regenerado',
          description: `Nuevo PIN: ${newPin}`,
        });
        setShowPin(true);
      },
      onError: () => {
        toast({
          title: 'Error',
          description: 'No se pudo regenerar el PIN',
          variant: 'destructive',
        });
      },
    });
  };

  const handleToggleStatus = () => {
    if (!portalAccess) return;
    toggleStatus.mutate(
      { accessId: portalAccess.id, isActive: !portalAccess.isActive },
      {
        onSuccess: () => {
          toast({
            title: portalAccess.isActive ? 'Portal desactivado' : 'Portal activado',
          });
        },
      }
    );
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copiado',
      description: `${label} copiado al portapapeles`,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-blue-600 flex items-center gap-2">
          🔗 Portal de Reservas
        </h3>
        <div className="animate-pulse h-20 bg-muted rounded-lg" />
      </div>
    );
  }

  if (!portalAccess) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-blue-600 flex items-center gap-2">
          🔗 Portal de Reservas
        </h3>
        <div className="bg-muted/50 border rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            Este cliente no tiene acceso al portal de reservas
          </p>
          <Button
            onClick={handleCreateAccess}
            disabled={createAccess.isPending}
            size="sm"
          >
            <Link2 className="h-4 w-4 mr-2" />
            {createAccess.isPending ? 'Creando...' : 'Activar Portal'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-blue-600 flex items-center gap-2">
          🔗 Portal de Reservas
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {portalAccess.isActive ? 'Activo' : 'Inactivo'}
          </span>
          <Switch
            checked={portalAccess.isActive}
            onCheckedChange={handleToggleStatus}
            disabled={toggleStatus.isPending}
          />
        </div>
      </div>

      <div className="bg-muted/30 border rounded-lg p-4 space-y-4">
        {/* Estado */}
        <div className="flex items-center gap-2">
          <Badge variant={portalAccess.isActive ? 'default' : 'secondary'}>
            {portalAccess.isActive ? '✓ Portal Activo' : '✗ Portal Inactivo'}
          </Badge>
          {portalAccess.lastAccessAt && (
            <span className="text-xs text-muted-foreground">
              Último acceso: {new Date(portalAccess.lastAccessAt).toLocaleDateString('es-ES')}
            </span>
          )}
        </div>

        {/* Link del portal */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Enlace del Portal</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-background px-3 py-2 rounded border truncate">
              {portalUrl}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(portalUrl, 'Enlace')}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => window.open(portalUrl, '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* PIN */}
        <div className="space-y-1">
          <label className="text-sm font-medium">PIN de Acceso</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-lg font-mono bg-background px-3 py-2 rounded border text-center tracking-widest">
              {showPin ? portalAccess.accessPin : '••••••'}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowPin(!showPin)}
            >
              {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(portalAccess.accessPin, 'PIN')}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleRegeneratePin}
              disabled={regeneratePin.isPending}
            >
              <RefreshCw className={`h-4 w-4 ${regeneratePin.isPending ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Comparte este enlace y PIN con el cliente para que pueda gestionar sus reservas
          </p>
        </div>
      </div>
    </div>
  );
};
