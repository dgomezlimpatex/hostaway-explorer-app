import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSede } from '@/contexts/SedeContext';
import { getMadridToday } from '@/utils/madridCalendar';
import { evaluatePmsHealth, type PmsHealth } from './pmsHealthDomain';
import { buildLhEvidence, buildSmoobuEvidence, type LhRaw, type SmoobuRaw } from './pmsHealthEvidence';
import { readLhRaw, readSmoobuRaw, type ReadOnlyDb } from './pmsHealthReads';

// Las tablas de los PMS no están en los tipos autogenerados (igual que en sus pantallas).
const readOnlyDb = supabase as unknown as ReadOnlyDb;

const TICK_MS = 60_000;
const ERROR = { state: 'error' } as const;
// Constantes estables para que la evaluación no se recalcule en cada render.
const SMOOBU_READ_FAILED: SmoobuRaw = { runs: ERROR, requests: ERROR, pending: ERROR };
const LH_READ_FAILED: LhRaw = { logs: ERROR, pending: ERROR };

/** Reloj que se renueva cada minuto para que las antigüedades no se queden congeladas. */
const useMinuteClock = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);
  return now;
};

export interface PmsHealthView {
  smoobu: PmsHealth | null;
  littleHotelier: PmsHealth | null;
  isLoading: boolean;
  isFetching: boolean;
  /** Vuelve a LEER la información. No inicia ninguna sincronización. */
  refresh: () => Promise<void>;
  /** Sede activa, a la que se acotan las incidencias asociadas a una sede. */
  sedeName: string | null;
  /** Cuándo se leyó por última vez la información mostrada. */
  readAt: Date | null;
}

export function usePmsHealth(): PmsHealthView {
  const { activeSede, loading: sedeLoading } = useSede();
  const sedeId = activeSede?.id ?? null;
  const sedeNombre = activeSede?.nombre ?? null;
  const clock = useMinuteClock();

  const smoobuQuery = useQuery({
    queryKey: ['pms-health', 'smoobu'],
    queryFn: () => readSmoobuRaw(readOnlyDb, getMadridToday()),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const lhQuery = useQuery({
    // La lectura no depende de la sede: la sede activa solo filtra lo que se muestra.
    queryKey: ['pms-health', 'little-hotelier'],
    queryFn: () => readLhRaw(readOnlyDb, getMadridToday()),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  // Si la propia consulta revienta, es un fallo de lectura: nunca un estado verde.
  const smoobuRaw: SmoobuRaw | undefined = smoobuQuery.isError ? SMOOBU_READ_FAILED : smoobuQuery.data;
  const lhRaw: LhRaw | undefined = lhQuery.isError ? LH_READ_FAILED : lhQuery.data;

  const smoobu = useMemo(
    () => (smoobuRaw ? evaluatePmsHealth(buildSmoobuEvidence(smoobuRaw, clock)) : null),
    [smoobuRaw, clock],
  );
  const littleHotelier = useMemo(
    () =>
      lhRaw
        ? evaluatePmsHealth(buildLhEvidence(lhRaw, clock, sedeId ? { id: sedeId, nombre: sedeNombre } : null))
        : null,
    [lhRaw, clock, sedeId, sedeNombre],
  );

  const { refetch: refetchSmoobu } = smoobuQuery;
  const { refetch: refetchLh } = lhQuery;
  const refresh = useCallback(async () => {
    await Promise.all([refetchSmoobu(), refetchLh()]);
  }, [refetchSmoobu, refetchLh]);

  const readAtMs = Math.max(smoobuQuery.dataUpdatedAt, lhQuery.dataUpdatedAt);

  return {
    smoobu,
    littleHotelier,
    isLoading: smoobuQuery.isLoading || lhQuery.isLoading || sedeLoading,
    isFetching: smoobuQuery.isFetching || lhQuery.isFetching,
    refresh,
    sedeName: activeSede?.nombre ?? null,
    readAt: readAtMs > 0 ? new Date(readAtMs) : null,
  };
}
