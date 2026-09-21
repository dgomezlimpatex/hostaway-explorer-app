import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSede } from '@/contexts/SedeContext';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { useAuth } from '@/hooks/useAuth';
import { SedeSelector } from '@/components/sede/SedeSelector';
import { createStaffingPageReader } from './readClient';
import { readForecastDataset } from './forecastReader';
import { getMonthlyForecastRange } from './monthly';
import { forecastQueryKey, madridNow, parseForecastContext, type ForecastScreen } from './forecastContract';
import { ForecastWorkspaceView } from './ForecastWorkspaceView';
import { computeForecastAsync } from './forecastCompute';

export type StaffingOperationalScreen = ForecastScreen;
export function StaffingOperationalWorkspace({ screen }: { screen: ForecastScreen }) {
  const { activeSede, isInitialized } = useSede();
  const { isAdminOrManager } = useRolePermissions();
  const { user } = useAuth();
  if (!isAdminOrManager()) return <p role="alert">La previsión está reservada a administración y responsables.</p>;
  if (!isInitialized || !activeSede || !user) return <p role="status">Selecciona una sede para consultar su plantilla.</p>;
  return <ConnectedForecast key={`${user.id}:${activeSede.id}`} screen={screen} sedeId={activeSede.id} sedeName={activeSede.nombre} userId={user.id} />;
}
function ConnectedForecast({ screen, sedeId, sedeName, userId }: { screen: ForecastScreen; sedeId: string; sedeName: string; userId: string }) {
  const [params] = useSearchParams();
  const [asOf, setAsOf] = useState(madridNow);
  const context = parseForecastContext(params, sedeId, asOf);
  const range = getMonthlyForecastRange(`${context.month}-01`, context.horizon);
  const queryClient = useQueryClient();
  const [cancelled, setCancelled] = useState('');
  const queryKey = forecastQueryKey(userId, sedeId, range.from, range.to);
  const requestId = queryKey.join(':');
  const query = useQuery({ queryKey, queryFn: ({ signal }) => readForecastDataset(createStaffingPageReader(signal), sedeId, range.from, range.to, signal), enabled: cancelled !== requestId, retry: false, staleTime: 60_000, gcTime: 300_000, refetchOnWindowFocus: false });
  const reinforcement = Number(params.get('refuerzo') ?? 0);
  const calculationKey = ['staffing-calculation', ...queryKey.slice(1), query.data?.fetchedAt, context, reinforcement];
  const calculation = useQuery({ queryKey: calculationKey, queryFn: ({ signal }) => computeForecastAsync(query.data!, context, reinforcement, signal), enabled: !!query.data && !query.isFetching && !query.isError && cancelled !== requestId, retry: false, staleTime: Infinity, gcTime: 300_000, refetchOnWindowFocus: false });
  return <ForecastWorkspaceView screen={screen} context={context} sedeName={sedeName} sedeControl={<SedeSelector />} dataset={!query.isFetching && !query.isError && cancelled !== requestId ? query.data : undefined}
    calculation={calculation.isFetching ? { pending: true } : calculation.isError ? { error: calculation.error instanceof Error ? calculation.error.message : 'Cálculo no disponible.' } : calculation.data ?? { pending: true }}
    loading={query.isFetching} error={query.isError ? 'No se ha podido completar la consulta.' : cancelled === requestId ? 'Consulta cancelada.' : undefined}
    refresh={() => { setCancelled(''); setAsOf(madridNow()); void queryClient.cancelQueries({ queryKey: calculationKey }); void query.refetch(); }}
    cancel={() => { setCancelled(requestId); void queryClient.cancelQueries({ queryKey }); void queryClient.cancelQueries({ queryKey: calculationKey }); }} />;
}
