import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Truck } from 'lucide-react';
import { Cleaner } from '@/types/calendar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Antes contenía también el diálogo y el panel antiguos de la ficha (sin uso desde
// la ficha integrada en /workers/:id). Solo queda la tarjeta de acceso al sistema de ruta.

type RouteWorkerAccessStatus = {
  success: true;
  access: {
    id: string;
    is_active: boolean;
    last_access_at: string | null;
    pin_synced_at: string | null;
  } | null;
  hasRegistroPin: boolean;
  isLinkedToRegistro: boolean;
  workerIsActive: boolean;
};

const invokeRouteWorkerManagement = async <T,>(body: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.functions.invoke('manage-laundry-route-workers', { body });
  if (error) {
    let message = error.message;
    const context = (error as { context?: Response }).context;
    if (context && typeof context.clone === 'function') {
      const payload = await context.clone().json().catch(() => null);
      if (payload?.error) message = String(payload.error);
    }
    throw new Error(message);
  }
  return data as T;
};

/**
 * Acceso al sistema de ruta (rol de repartidor). Solo debe montarse para administración
 * y gerencia: supervisión no consulta la función. Muestra el error real de la consulta.
 */
export const RouteWorkerAccessCard = ({ worker }: { worker: Cleaner }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const queryKey = ['laundry-route-worker-access', worker.id];
  const { data: status, isLoading, error: statusError, refetch } = useQuery({
    queryKey,
    queryFn: () => invokeRouteWorkerManagement<RouteWorkerAccessStatus>({
      action: 'status',
      cleanerId: worker.id,
    }),
    retry: false,
  });

  const toggleAccess = useMutation({
    mutationFn: (enabled: boolean) => invokeRouteWorkerManagement<{ success: true; active: boolean }>({
      action: 'set_active',
      cleanerId: worker.id,
      enabled,
    }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey });
      toast({
        title: result.active ? 'Rol de repartidor activado' : 'Rol de repartidor retirado',
        description: result.active
          ? 'Ya puede entrar en el nuevo sistema de ruta con su PIN de REGISTRO.'
          : 'Sus sesiones de ruta han quedado cerradas.',
      });
    },
    onError: (error) => {
      toast({
        title: 'No se pudo cambiar el acceso',
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
        variant: 'destructive',
      });
    },
  });

  const isEnabled = status?.access?.is_active === true;
  const canEnable = status?.hasRegistroPin && status?.workerIsActive;

  return (
    <section className="p-panel" aria-labelledby={`acceso-ruta-${worker.id}`}>
      <div className="p-panel-head">
        <h2 id={`acceso-ruta-${worker.id}`}>
          <Truck className="mr-2 inline h-4 w-4" aria-hidden="true" />
          Sistema de ruta
        </h2>
        {status && <span className={`p-tag ${isEnabled ? 'active' : ''}`}>{isEnabled ? 'Repartidor' : 'Sin acceso'}</span>}
      </div>
      <div className="p-content">
        <p className="p-muted">Acceso a los enlaces de ruta con el PIN sincronizado desde REGISTRO.</p>
        {isLoading ? (
          <p className="p-muted mt-3" role="status">Consultando el acceso de ruta…</p>
        ) : statusError ? (
          <p className="p-notice p-error mt-3" role="alert">
            No se pudo consultar el acceso de ruta.{' '}
            <button type="button" className="p-link" onClick={() => refetch()}>Reintentar</button>
          </p>
        ) : (
          <>
            {!status?.hasRegistroPin && (
              <p className="p-notice mt-3">No se puede activar: este trabajador no tiene PIN en REGISTRO.</p>
            )}
            {status?.hasRegistroPin && !status?.workerIsActive && !isEnabled && (
              <p className="p-notice mt-3">No se puede activar mientras el perfil esté inactivo.</p>
            )}
            <div className="p-form-actions">
              <button
                type="button"
                className="p-button small"
                disabled={toggleAccess.isPending || (!isEnabled && !canEnable)}
                onClick={() => setConfirmOpen(true)}
              >
                {toggleAccess.isPending
                  ? 'Guardando…'
                  : isEnabled
                    ? 'Quitar rol de repartidor…'
                    : 'Asignar rol de repartidor…'}
              </button>
            </div>
          </>
        )}
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isEnabled ? `¿Quitar el rol de repartidor a ${worker.name}?` : `¿Asignar el rol de repartidor a ${worker.name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isEnabled
                ? 'Se cerrarán sus sesiones del sistema de ruta.'
                : 'Podrá entrar en los enlaces de ruta con su PIN de REGISTRO.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => toggleAccess.mutate(!isEnabled)}>
              {isEnabled ? 'Quitar rol' : 'Asignar rol'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};
