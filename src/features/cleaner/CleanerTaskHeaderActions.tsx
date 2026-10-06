import { useState } from 'react';
import { Cloud, CloudOff, CloudUpload, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CleanerPropertyDetails, type CleanerPropertyDetailsData } from './CleanerPropertyDetails';

interface WorkStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pending: number;
  pendingPhotos: number;
  error: string | null;
  shellReady: boolean;
  shellError: boolean;
  sync: () => Promise<void>;
}

// Shared presentation mapping is also exercised without a browser.
// eslint-disable-next-line react-refresh/only-export-components
export function getCleanerTaskStatus(status: WorkStatus) {
  if (!status.isOnline) return { state: 'pending', label: 'Sin sincronizar',
    text: status.pending || status.pendingPhotos ? 'Sin cobertura. Tu trabajo pendiente se enviará cuando recuperes conexión.' : 'Sin cobertura. Puedes usar la información descargada en este móvil.',
    color: 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-600', Icon: CloudOff };
  if (status.isSyncing) return { state: 'sending', label: 'Sincronizando',
    text: 'Estamos enviando tus cambios. Mantén la app abierta un momento.',
    color: 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-600', Icon: CloudUpload };
  if (status.error || status.pending || status.pendingPhotos) return { state: 'pending', label: 'Sin sincronizar',
    text: status.error ? 'No se ha podido confirmar el envío. Comprueba la conexión y vuelve a intentarlo.' : 'Hay trabajo pendiente de enviar. Mantén la app abierta con cobertura para enviarlo.',
    color: 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-600', Icon: CloudOff };
  return { state: 'confirmed', label: 'Sincronizado', text: 'Todo tu trabajo está enviado. No hay cambios pendientes.',
    color: 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-700', Icon: Cloud };
}

export function CleanerTaskHeaderActions({ property, taskNotes, propertyName, loading, status }: {
  property?: CleanerPropertyDetailsData | null;
  taskNotes?: string;
  propertyName: string;
  loading: boolean;
  status: WorkStatus | null;
}) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const view = status ? getCleanerTaskStatus(status) : null;
  return <div className="flex shrink-0 items-start gap-1.5" onKeyDownCapture={event => {
    if (event.key === 'Escape' && (notesOpen || statusOpen)) {
      event.preventDefault();
      event.stopPropagation();
      setNotesOpen(false);
      setStatusOpen(false);
    }
  }}>
    <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="min-h-11 gap-1.5 px-2.5 text-xs font-semibold">
          <FileText className="h-4 w-4" aria-hidden="true" />NOTAS
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85dvh] w-[calc(100%-1.5rem)] flex-col rounded-2xl p-4 sm:max-w-lg">
        <DialogHeader className="shrink-0 pr-6 text-left">
          <DialogTitle>Notas del piso</DialogTitle>
          <DialogDescription>{propertyName} · Indicaciones y datos del piso</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto overscroll-contain">
          {loading && !property && <p role="status" className="mb-3 text-sm">Cargando las notas del piso…</p>}
          {!loading && !property && <p className="mb-3 text-sm text-muted-foreground">La ficha del piso no está disponible. Abre la tarea con cobertura para consultarla.</p>}
          <CleanerPropertyDetails property={property} taskNotes={taskNotes} />
        </div>
        <DialogClose asChild><Button type="button" variant="outline" className="min-h-11 shrink-0">Volver a la tarea</Button></DialogClose>
      </DialogContent>
    </Dialog>
    {status && view && <Popover open={statusOpen} onOpenChange={setStatusOpen} modal>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon" className={`h-11 w-11 shrink-0 rounded-full ${view.color}`}
          data-work-state={view.state} aria-label={`Sincronización: ${view.label}`} title={view.label}>
          <view.Icon className={`h-5 w-5 ${view.state === 'sending' ? 'animate-pulse motion-reduce:animate-none' : ''}`} aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 max-w-[calc(100vw-2rem)] space-y-2 text-sm" aria-label="Estado de sincronización">
        <p className="font-semibold">{view.label}</p>
        <p>{view.text}</p>
        {(status.pending > 0 || status.pendingPhotos > 0) && <p className="text-xs text-muted-foreground">{status.pending} {status.pending === 1 ? 'tarea pendiente' : 'tareas pendientes'}{status.pendingPhotos > 0 ? ` · ${status.pendingPhotos} fotos` : ''}.</p>}
        {status.isOnline && !status.shellReady && <p className="text-xs text-muted-foreground">{status.shellError ? 'Abre de nuevo la app con buena conexión para prepararla sin cobertura.' : 'Preparando la app para abrirla sin cobertura…'}</p>}
        {status.isOnline && (status.pending > 0 || status.error) && <Button type="button" variant="outline" className="min-h-11 w-full" disabled={status.isSyncing} onClick={() => void status.sync()}>Reintentar envío</Button>}
      </PopoverContent>
    </Popover>}
    {view && <span className="sr-only" role="status" aria-live="polite">{view.label}</span>}
  </div>;
}
