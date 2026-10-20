
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, ExternalLink, RefreshCw, Eye, EyeOff, Link2, Globe2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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

// Helper to create URL-friendly slug from client name
const createClientSlug = (name: string): string => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .substring(0, 50); // Limit length
};

type PendingAction = 'create' | 'regenerate' | 'toggle' | null;

/**
 * Acceso del cliente a su portal. Solo se monta para administración y gerencia.
 * Cada acción tiene efecto inmediato sobre el acceso del cliente, por eso se confirma.
 */
export const ClientPortalSection = ({ clientId, clientName }: ClientPortalSectionProps) => {
  const { toast } = useToast();
  const [showPin, setShowPin] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);

  const { data: portalAccess, isLoading, isError, refetch } = useClientPortalAccess(clientId);
  const createAccess = useCreatePortalAccess();
  const regeneratePin = useRegeneratePin();
  const toggleStatus = useTogglePortalStatus();

  const baseUrl = window.location.origin;
  const clientSlug = createClientSlug(clientName);
  // Use short_code for cleaner URLs: /portal/client-slug-abc12def
  const portalUrl = portalAccess?.shortCode
    ? `${baseUrl}/portal/${clientSlug}-${portalAccess.shortCode}`
    : '';

  // Los avisos de éxito y error los muestran los propios hooks; aquí solo se revela el PIN nuevo.
  const confirm = () => {
    const action = pending;
    setPending(null);
    if (action === 'create') createAccess.mutate(clientId, { onSuccess: () => setShowPin(true) });
    if (action === 'regenerate' && portalAccess) regeneratePin.mutate(portalAccess.id, { onSuccess: () => setShowPin(true) });
    if (action === 'toggle' && portalAccess) toggleStatus.mutate({ accessId: portalAccess.id, isActive: !portalAccess.isActive });
  };

  const copyToClipboard = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    toast({
      title: 'Copiado',
      description: `${label} copiado al portapapeles`,
    });
  };

  const dialog = {
    create: { title: 'Activar el portal de reservas', description: `Se generará un enlace y un PIN para ${clientName}. El cliente podrá entrar en cuanto se los compartas.`, action: 'Activar portal' },
    regenerate: { title: '¿Regenerar el PIN?', description: 'El PIN actual dejará de funcionar inmediatamente. Tendrás que enviar el nuevo PIN al cliente para que pueda volver a entrar.', action: 'Regenerar PIN' },
    toggle: portalAccess?.isActive
      ? { title: '¿Desactivar el portal?', description: 'El cliente dejará de poder entrar en el portal hasta que lo vuelvas a activar. Sus reservas no se borran.', action: 'Desactivar portal' }
      : { title: '¿Activar el portal?', description: 'El cliente podrá volver a entrar con su enlace y PIN actuales.', action: 'Activar portal' },
  } as const;

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-sm font-black text-slate-950"><Globe2 className="h-4 w-4 text-[#310984]" />Portal de reservas</h3>
      <Button asChild variant="link" size="sm" className="h-auto p-0 text-[#310984]"><Link to="/admin/client-portals">Ver todos los portales</Link></Button>
    </div>
  );

  let body;
  if (isLoading) {
    body = <div role="status" aria-label="Cargando portal" className="h-20 animate-pulse rounded-lg bg-muted" />;
  } else if (isError) {
    body = <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">No se ha podido consultar el portal.<Button variant="outline" size="sm" className="ml-2" onClick={() => void refetch()}>Reintentar</Button></div>;
  } else if (!portalAccess) {
    body = (
      <div className="rounded-lg border bg-muted/50 p-4 text-center">
        <p className="mb-3 text-sm text-muted-foreground">Este cliente no tiene acceso al portal de reservas.</p>
        <Button onClick={() => setPending('create')} disabled={createAccess.isPending} size="sm" type="button">
          <Link2 className="mr-2 h-4 w-4" />
          {createAccess.isPending ? 'Creando…' : 'Activar portal'}
        </Button>
      </div>
    );
  } else {
    body = (
      <div className="min-w-0 space-y-4 rounded-lg border bg-muted/30 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={portalAccess.isActive ? 'default' : 'secondary'}>{portalAccess.isActive ? 'Portal activo' : 'Portal inactivo'}</Badge>
            <span className="text-xs text-muted-foreground">
              {portalAccess.lastAccessAt ? `Último acceso: ${new Date(portalAccess.lastAccessAt).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' })}` : 'Sin accesos registrados'}
            </span>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            {portalAccess.isActive ? 'Activo' : 'Inactivo'}
            <Switch aria-label={portalAccess.isActive ? 'Desactivar portal' : 'Activar portal'} checked={portalAccess.isActive} onCheckedChange={() => setPending('toggle')} disabled={toggleStatus.isPending} />
          </label>
        </div>

        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">Enlace del portal</p>
          <div className="flex min-w-0 items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded border bg-background px-3 py-2 text-xs">{portalUrl}</code>
            <Button variant="outline" size="icon" aria-label="Copiar enlace" onClick={() => copyToClipboard(portalUrl, 'Enlace')} type="button"><Copy className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" aria-label="Abrir portal" onClick={() => window.open(portalUrl, '_blank')} type="button"><ExternalLink className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">PIN de acceso</p>
          <div className="flex min-w-0 items-center gap-2">
            <code className="min-w-0 flex-1 rounded border bg-background px-3 py-2 text-center font-mono text-lg tracking-widest">{showPin ? portalAccess.accessPin : '••••••'}</code>
            <Button variant="outline" size="icon" aria-label={showPin ? 'Ocultar PIN' : 'Mostrar PIN'} onClick={() => setShowPin(!showPin)} type="button">{showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
            <Button variant="outline" size="icon" aria-label="Copiar PIN" onClick={() => copyToClipboard(portalAccess.accessPin, 'PIN')} type="button"><Copy className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" aria-label="Regenerar PIN" onClick={() => setPending('regenerate')} disabled={regeneratePin.isPending} type="button">
              <RefreshCw className={`h-4 w-4 ${regeneratePin.isPending ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Comparte este enlace y el PIN con el cliente para que pueda gestionar sus reservas.</p>
        </div>
      </div>
    );
  }

  return (
    <section className="min-w-0 space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      {header}
      {body}
      <AlertDialog open={pending !== null} onOpenChange={open => !open && setPending(null)}>
        <AlertDialogContent className="w-[calc(100%-1rem)] rounded-2xl">
          {pending && <>
            <AlertDialogHeader>
              <AlertDialogTitle>{dialog[pending].title}</AlertDialogTitle>
              <AlertDialogDescription>{dialog[pending].description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirm}>{dialog[pending].action}</AlertDialogAction>
            </AlertDialogFooter>
          </>}
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};
