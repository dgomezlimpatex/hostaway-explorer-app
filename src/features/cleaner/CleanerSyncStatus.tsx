import { Cloud, CloudUpload, WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCleanerOfflineStatus } from './CleanerOfflineProvider';

export function CleanerSyncStatus({ className = '' }: { className?: string }) {
  const status = useCleanerOfflineStatus();
  if (!status) return null;
  const Icon = !status.isOnline ? WifiOff : status.pending ? CloudUpload : Cloud;
  return <div role="status" aria-live="polite" className={`rounded-xl border p-3 text-sm ${status.error ? 'border-amber-300 bg-amber-50' : 'border-purple-100 bg-purple-50/60'} ${className}`}>
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="flex-1 font-medium">{!status.isOnline ? 'Sin cobertura · trabajo guardado en este móvil' : status.isSyncing ? 'Enviando el trabajo guardado…' : status.pending ? 'Trabajo guardado en este móvil' : 'Sin envíos pendientes'}</span>
      {status.isOnline && status.pending > 0 && <Button type="button" variant="ghost" size="sm" className="min-h-11" disabled={status.isSyncing} onClick={() => void status.sync()} aria-label="Reintentar envío">
        <RefreshCw className={`h-4 w-4 ${status.isSyncing ? 'animate-spin' : ''}`} />
      </Button>}
    </div>
    {status.pending > 0 && <p className="mt-1 text-xs">{status.pending} {status.pending === 1 ? 'tarea pendiente' : 'tareas pendientes'} de enviar{status.pendingPhotos ? ` · ${status.pendingPhotos} fotos` : ''}. Abre la app con cobertura para confirmar el envío.</p>}
    {!status.isOnline && !status.pending && <p className="mt-1 text-xs">Se muestra la información descargada en este móvil. Las nuevas asignaciones llegarán al recuperar conexión.</p>}
    {status.isOnline && !status.shellReady && <p className="mt-1 text-xs">{status.shellError ? 'No se ha preparado la reapertura sin cobertura. Mantén la app abierta y vuelve a entrar con buena conexión.' : 'Preparando la app para poder abrirla sin cobertura…'}</p>}
    {status.error && <p className="mt-2 text-xs text-amber-900">{status.error}</p>}
  </div>;
}
