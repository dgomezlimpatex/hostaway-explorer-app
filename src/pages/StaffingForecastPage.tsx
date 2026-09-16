import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSede } from '@/contexts/SedeContext';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { useAuth } from '@/hooks/useAuth';
import { StaffingDashboard } from '@/features/staffing/StaffingDashboard';
import { StaffingHeader } from '@/features/staffing/StaffingChrome';
import { fieldClass } from '@/features/staffing/presentation';
import { buildStaffingForecast } from '@/features/staffing/engine';
import { datePlus, readStaffingDataset } from '@/features/staffing/data';
import { createStaffingPageReader } from '@/features/staffing/readClient';
import { staffingRulesForSede } from '@/features/staffing/businessRules';
import { formatMadridDate } from '@/utils/date';
import { getMonthlyForecastRange } from '@/features/staffing/monthly';

export default function StaffingForecastPage() {
  const { activeSede, isInitialized } = useSede();
  const { isAdminOrManager } = useRolePermissions();
  const { user } = useAuth();
  if (!isAdminOrManager()) return <p role="alert" className="p-6">La previsión de plantilla está reservada a administración y responsables.</p>;
  if (!isInitialized || !activeSede || !user) return <p role="status" className="p-6">Selecciona una sede para consultar su plantilla.</p>;
  return <StaffingWorkspace key={`${user.id}:${activeSede.id}`} sedeId={activeSede.id} sedeName={activeSede.nombre} userId={user.id} />;
}
function StaffingWorkspace({ sedeId, sedeName, userId }: { sedeId: string; sedeName: string; userId: string }) {
  const today = formatMadridDate(new Date());
  const initialHorizonMonths = 3;
  const initialRange = getMonthlyForecastRange(today, initialHorizonMonths);
  const [monthAnchor, setMonthAnchor] = useState(today);
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [weeks, setWeeks] = useState(initialRange.weeks);
  const [horizonMonths, setHorizonMonths] = useState(initialHorizonMonths);
  const [requested, setRequested] = useState(false);
  const [dirty, setDirty] = useState(false);
  const queryClient = useQueryClient();
  const dateTo = datePlus(dateFrom, weeks * 7 - 1);
  const query = useQuery({
    queryKey: ['staffing-forecast', userId, sedeId, dateFrom, dateTo],
    queryFn: ({ signal }) => readStaffingDataset(createStaffingPageReader(signal), sedeId, dateFrom, dateTo, staffingRulesForSede(sedeId)),
    enabled: requested,
    retry: false,
    staleTime: 60_000,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
  const allowReset = () => !dirty || window.confirm('¿Descartar el escenario y consultar otro periodo o actualizar los datos?');
  const refresh = () => { if (!allowReset()) return; if (requested) void query.refetch(); else setRequested(true); };
  const controls = <>
    <label className="grid gap-1 text-xs font-medium">Mes inicial<input aria-label="Mes inicial de previsión" className={fieldClass} type="month" value={monthAnchor.slice(0, 7)} disabled={query.isFetching} onChange={event => { const value = event.target.value; if (!/^\d{4}-\d{2}$/.test(value) || !allowReset()) return; const anchor = `${value}-01`; const range = getMonthlyForecastRange(anchor, horizonMonths); setMonthAnchor(anchor); setDateFrom(range.from); setWeeks(range.weeks); setRequested(false); }} /></label>
    <label className="grid gap-1 text-xs font-medium">Horizonte de previsión<select aria-label="Horizonte de previsión" className={fieldClass} value={horizonMonths} disabled={query.isFetching} onChange={event => { if (!allowReset()) return; const value = Number(event.target.value); const range = getMonthlyForecastRange(monthAnchor, value); setHorizonMonths(value); setDateFrom(range.from); setWeeks(range.weeks); setRequested(false); }}>{[1, 3, 6].map(value => <option key={value} value={value}>{value === 1 ? 'Cada mes' : `Próximos ${value} meses`}</option>)}</select></label>
    {query.isFetching ? <button type="button" className={fieldClass} onClick={() => { setRequested(false); void queryClient.cancelQueries({ queryKey: ['staffing-forecast', userId, sedeId, dateFrom, dateTo] }); }}>Cancelar consulta</button> : <button type="button" className={fieldClass} onClick={refresh}>{query.isError ? 'Reintentar' : requested ? 'Actualizar' : 'Consultar datos de la sede'}</button>}
  </>;
  if (requested && query.data && !query.isFetching && !query.isError) return <StaffingDashboard key={`${sedeId}:${dateFrom}:${weeks}:${query.data.fetchedAt}`} dataset={query.data} dateFrom={dateFrom} monthAnchor={monthAnchor} horizonMonths={horizonMonths} asOf={today} weeks={weeks} compute={buildStaffingForecast} sedeName={sedeName} controls={controls} onDirtyChange={setDirty} onRetry={refresh} />;
  return <section className="min-w-0 space-y-6 bg-[#f7f6f3] p-3 text-stone-900 sm:p-6"><StaffingHeader sedeName={sedeName} dateFrom={dateFrom} dateTo={dateTo}>{controls}</StaffingHeader>
    {!requested && <p className="py-10 text-center text-sm text-stone-600">Selecciona el periodo y consulta los datos para empezar. Los escenarios solo se mantienen en esta pantalla.</p>}
    {query.isFetching && <p role="status" className="py-10 text-center text-sm text-stone-600">Leyendo fuentes… El resultado anterior permanece oculto durante la actualización.</p>}
    {query.isError && <p role="alert" className="rounded-md border border-rose-300 bg-white p-4 text-sm text-rose-900">{query.error instanceof Error ? query.error.message : 'No se pudo completar la lectura.'} Reintenta la consulta; un fallo no significa ausencia de trabajo.</p>}
  </section>;
}
