import { useEffect, useState } from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { offlineStorage } from '@/utils/offlineStorage';

// Legacy entries have no durable file bytes and cannot safely be replayed.
// Preserve them for recovery; never remove entries or claim a simulated send.
export const OfflineSyncIndicator = ({ className = '' }: { className?: string }) => {
  const { isOnline } = useNetworkStatus();
  const [stats, setStats] = useState(offlineStorage.getStats());
  useEffect(() => {
    const timer = setInterval(() => setStats(offlineStorage.getStats()), 5000);
    return () => clearInterval(timer);
  }, []);
  const pending = stats.pendingOperations + stats.offlineReports;
  if (!pending && isOnline) return null;
  return <div role="status" className={`rounded-lg border bg-amber-50 p-3 text-sm ${className}`}>
    {pending ? <><p className="font-medium">Hay {pending} registros del guardado antiguo pendientes de revisar.</p>
      <p className="mt-1 text-xs">Su envío no está confirmado. Consulta con coordinación antes de borrar estos datos; puede ser necesario volver a adjuntar las fotos.</p></>
      : <p>Sin conexión. Recupera cobertura para guardar desde esta pantalla.</p>}
  </div>;
};
