import { monthLabel } from './forecastContract';
import { countLabel, normalize } from './forecastPresentation';
import { Empty, TaskList, type ScreenProps } from './ForecastUi';

/** The URL holds these filters so task/candidate details can return to this list. */
export function ForecastPersonTasks(props: ScreenProps & { personId: string; month: string }) {
  const { dataset, model, params, change, personId, month } = props;
  const query = params.get('personTaskQuery') ?? '';
  const date = params.get('personTaskDate') ?? '';
  const kind = params.get('personTaskKind') ?? 'all';
  const filter = (values: Record<string, string>) => change({ person: personId, personTab: 'tasks', task: params.get('task') ?? '', detail: params.get('detail') ?? '', ...values });
  const clear = () => filter({ personTaskQuery: '', personTaskDate: '', personTaskKind: '' });
  const matches = dataset.tasks.filter(t => t.date.startsWith(month) && (!date || t.date === date) && normalize(`${t.name} ${dataset.centers.find(c => c.id === t.centerId)?.name ?? ''}`).includes(normalize(query)))
    .sort((a, b) => a.date.localeCompare(b.date) || (Number.isFinite(a.start) ? a.start : a.windowStart) - (Number.isFinite(b.start) ? b.start : b.windowStart) || a.name.localeCompare(b.name, 'es'));
  const registered = kind === 'proposed' ? [] : matches.filter(t => t.workerId === personId);
  const proposed = kind === 'registered' ? [] : matches.filter(t => model.placements.some(p => p.taskId === t.id && p.workerId === personId && !p.real));
  const hasFilters = !!query || !!date || kind !== 'all';
  return <>
    <div className="sf-toolbar">
      <label>Buscar tarea o centro<input type="search" value={query} onChange={e => filter({ personTaskQuery: e.target.value })} /></label>
      <label>Fecha de la tarea<input type="date" value={date} onChange={e => filter({ personTaskDate: e.target.value })} /></label>
      <label>Tipo de tareas<select value={kind} onChange={e => filter({ personTaskKind: e.target.value })}><option value="all">Registradas y propuestas</option><option value="registered">Solo registradas</option><option value="proposed">Solo propuestas</option></select></label>
      {hasFilters && <button onClick={clear}>Limpiar filtros de tareas</button>}
    </div>
    <p>{monthLabel(month)} · {countLabel(registered.length, 'asignación registrada', 'asignaciones registradas')} · {countLabel(proposed.length, 'propuesta')}.</p>
    {!registered.length && !proposed.length ? <Empty reset={hasFilters ? clear : undefined}>{hasFilters ? 'No hay tareas con estos filtros.' : 'No hay tareas registradas ni propuestas para esta persona en este mes.'}</Empty> : <>
      {kind !== 'proposed' && <><h3>Asignaciones registradas</h3><TaskList {...props} tasks={registered} returnTo={{ returnPerson: personId }} /></>}
      {kind !== 'registered' && <details className="sf-detail-block" open={kind === 'proposed'}><summary>Propuestas de tareas · sin guardar</summary><TaskList {...props} tasks={proposed} returnTo={{ returnPerson: personId }} /></details>}
    </>}
  </>;
}
