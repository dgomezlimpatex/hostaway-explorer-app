import { Link } from 'react-router-dom';
import { addCivilDays } from './monthly';
import { hours, dateLabel, monthLabel, monday } from './forecastContract';
import { attentionDays, coverageLabel, countLabel, dayNames, demandSummary, focusMonth, fullDate, horizonScope, scopeQuery, scopedTasks, shortDay, simulationChanges, sumComplete, sumKnown, teamSummary, viewScope, within, type ViewScope } from './forecastPresentation';
import { Badge, Empty, ForecastChart, Metric, Panel, TaskList, type ScreenProps } from './ForecastUi';
import { ForecastCapacityBreakdown } from './ForecastCapacityBreakdown';

function TeamAttention({ model, to, month }: Pick<ScreenProps, 'model' | 'to'> & { month: string }) {
  const team = teamSummary(model, month);
  if (!model.months.some(m => m.key === month)) return <Metric label={'Objetivos de ' + monthLabel(month)} value="Sin calcular" to={to('team', { focusMonth: month })} />;
  return <div className={'sf-metric sf-team-attention ' + (team.unknown.length ? 'sf-attention' : '')}>
    <span>Objetivos de {monthLabel(month)}</span>
    <Link className="sf-attention-primary" to={to('team', { focusMonth: month, filter: team.unknown.length ? 'unknown' : 'risk' })}><strong>{team.unknown.length || team.risk.length}</strong><span>{team.unknown.length ? (team.unknown.length === 1 ? 'persona pendiente de evaluar' : 'personas pendientes de evaluar') : (team.risk.length === 1 ? 'persona con horas pendientes' : 'personas con horas pendientes')}</span></Link>
    {team.unknown.length > 0 && <Link to={to('team', { focusMonth: month, filter: 'risk' })}>{countLabel(team.risk.length, 'persona')} con déficit confirmado →</Link>}
    {team.risk.length > 0 && <small>{hours(sumKnown(team.risk, l => l.missing))} por completar · revisar reparto y otros servicios</small>}
  </div>;
}

export function ForecastHome(props: ScreenProps) {
  const { model, to, params } = props;
  const scope = viewScope(model.context, new URLSearchParams({ focusMonth: focusMonth(model.context, params) }));
  const team = teamSummary(model, scope.from.slice(0, 7));
  const tasks = scopedTasks(model, scope, 'pending');
  const today = model.context.asOf.slice(0, 10);
  const start = within(today, scope) ? today : scope.from;
  const week = model.days.filter(d => d.date >= start && d.date <= addCivilDays(start, 6) && within(d.date, scope));
  const review = attentionDays(model, scope);
  return <>
    <Panel title="Pendiente de revisar"><div className="sf-worklist">
      {team.unknown.length > 0 && <Link to={to('team', { filter: 'unknown', focusMonth: scope.from.slice(0, 7) })}><div><strong>{countLabel(team.unknown.length, 'persona')} pendiente{team.unknown.length === 1 ? '' : 's'} de evaluación</strong><p>Objetivos de {monthLabel(scope.from.slice(0, 7))}.</p></div><span>Ver personas →</span></Link>}
      {tasks.length > 0 && <Link to={to('shifts', { ...scopeQuery(scope), filter: 'pending' })}><div><strong>{countLabel(tasks.length, 'tarea')} sin asignar</strong><p>{scope.label}.</p></div><span>Revisar tareas →</span></Link>}
      {team.risk.length > 0 && <Link to={to('team', { filter: 'risk', focusMonth: scope.from.slice(0, 7) })}><div><strong>{countLabel(team.risk.length, 'persona')} con horas por completar</strong><p>{hours(sumKnown(team.risk, l => l.missing))} pendientes sobre objetivos verificables.</p></div><span>Revisar equipo →</span></Link>}
      {model.issues.some(i => i.impact !== 'information') && <Link to={to('settings', { tab: 'data' })}><div><strong>Revisar datos que impiden cerrar la previsión</strong><p>Causas, ámbito y registros afectados.</p></div><span>Revisar datos →</span></Link>}
      {!tasks.length && !team.risk.length && !team.unknown.length && !model.issues.length && <Empty>No hay pendientes identificados con los registros de este periodo.</Empty>}
    </div></Panel>
    <div className="sf-metrics sf-three"><TeamAttention {...props} month={scope.from.slice(0, 7)} /><Metric label="Tareas sin asignar" value={tasks.length} note={scope.label} to={to('shifts', { ...scopeQuery(scope), filter: 'pending' })} /><Metric label="Días próximos por resolver" value={review.upcoming.length} note={review.past.length + ' días anteriores por revisar por separado'} to={to('shifts', { ...scopeQuery(scope), filter: 'uncovered' })} /></div>
    <Panel title={'Siete días desde el ' + dateLabel(start)}><div className="sf-day-grid">{week.map(day => <Link key={day.date} to={to('shifts', { view: 'day', date: day.date, focusMonth: day.date.slice(0, 7), week: monday(day.date) })}><strong>{dayNames[new Date(day.date + 'T12:00Z').getUTCDay()]}</strong><span>{dateLabel(day.date)}</span><b>{hours(day.known)}</b><small>{day.unassigned} sin asignar</small><Badge>{coverageLabel(model, { ...scope, from: day.date, to: day.date })}</Badge></Link>)}</div></Panel>
    <div className="sf-inline-links"><Link className="sf-button" to={to('forecast')}>Ver previsión completa</Link><Link className="sf-button" to={to('team')}>Consultar equipo</Link></div>
  </>;
}

export function ForecastSummary(props: ScreenProps & { onSimulate: () => void }) {
  const { model, params, to, change, onSimulate } = props;
  const weekly = params.get('view') === 'week';
  const scope = weekly ? viewScope(model.context, params) : horizonScope(model.context);
  const days = model.days.filter(d => within(d.date, scope));
  const tasks = scopedTasks(model, scope), reviewTasks = scopedTasks(model, scope, 'uncovered');
  const demand = demandSummary(tasks), focus = focusMonth(model.context, params);
  const attention = attentionDays(model, scope);
  const hasReserve = model.context.scenario === 'reserve';
  const weekIndex = model.weeks.findIndex(w => w.key === model.context.week);
  const changeWeek = (week: string) => change({ week, focusMonth: '', date: '', view: 'week' });
  const lastTask = [...model.tasks].sort((a, b) => b.date.localeCompare(a.date))[0];
  const phase = (from: string, to: string) => to < model.context.asOf.slice(0, 10) ? 'Pasado' : from > model.context.asOf.slice(0, 10) ? 'Futuro' : 'Incluye fecha de consulta';
  const useful = (from: string, to = from) => sumKnown(model.placements.filter(p => !p.real && p.workerId === 'hypothetical' && p.date >= from && p.date <= to && (!model.context.center || p.centerId === model.context.center)), p => p.minutes);
  const chartRows = weekly ? days.map(d => ({ ...d, key: shortDay(d.date), label: fullDate(d.date), phase: phase(d.date, d.date), reserve: 0, reinforcement: useful(d.date) })) : model.weeks.map(w => {
    const included = days.filter(d => monday(d.date) === w.key), first = included[0]?.date ?? w.key, last = included.at(-1)?.date ?? w.key;
    return { key: dateLabel(w.key), label: included.length < 7 ? fullDate(first) + ' – ' + fullDate(last) + ' · semana parcial, ' + countLabel(included.length, 'día') : 'Semana del ' + fullDate(w.key), phase: phase(first, last), partial: included.length < 7, known: sumComplete(included, d => d.known), capacity: sumComplete(included, d => d.capacity), reserve: sumComplete(included, d => d.tourism) * .2, reinforcement: useful(first, last) };
  });
  const dayRow = (day: typeof days[number], reasons?: string[]) => <div key={day.date}><strong title={fullDate(day.date)}>{shortDay(day.date)}</strong><span>{Number.isFinite(day.known) ? hours(day.known) + ' conocidas' : 'Duración pendiente'} · {day.unassigned} sin asignar{reasons && <small>{reasons.join(' · ')}</small>}</span><Badge>{coverageLabel(model, { ...scope, from: day.date, to: day.date })}</Badge><Link to={to('shifts', { view: 'day', date: day.date, focusMonth: day.date.slice(0, 7), week: monday(day.date), filter: '' })}>Ver tareas del día</Link></div>;
  const monthlyTeam = (month: string) => { const team = teamSummary(model, month); return <div className="sf-month-team"><Link to={to('team', { focusMonth: month, filter: 'unknown' })}>{countLabel(team.unknown.length, 'persona')} por evaluar</Link><Link to={to('team', { focusMonth: month, filter: 'risk' })}>{countLabel(team.risk.length, 'persona')} con horas pendientes</Link></div>; };
  return <>
    <div className="sf-toolbar sf-forecast-toolbar"><div className="sf-segment"><button aria-pressed={!weekly} onClick={() => change({ view: '', date: '' })}>Resumen mensual</button><button aria-pressed={weekly} onClick={() => change({ view: 'week', focusMonth: '', date: '' })}>Detalle semanal</button></div><div className="sf-segment"><button aria-pressed={!hasReserve} onClick={() => change({ scenario: 'known' })}>Trabajo conocido</button><button aria-pressed={hasReserve} onClick={() => change({ scenario: 'reserve' })}>Con reserva +20 %</button></div><button className="sf-primary" onClick={onSimulate}>Simular refuerzo</button></div>
    {weekly && <div className="sf-toolbar"><button disabled={weekIndex <= 0} onClick={() => changeWeek(model.weeks[weekIndex - 1].key)}>Semana anterior</button><label>Semana<select value={model.context.week} onChange={e => changeWeek(e.target.value)}>{model.weeks.map(w => <option key={w.key} value={w.key}>{shortDay(w.key)} – {shortDay(addCivilDays(w.key, 6))}</option>)}</select></label><button disabled={weekIndex >= model.weeks.length - 1} onClick={() => changeWeek(model.weeks[weekIndex + 1].key)}>Semana siguiente</button><button disabled={!model.weeks.some(w => w.key === monday(model.context.asOf.slice(0, 10)))} onClick={() => changeWeek(monday(model.context.asOf.slice(0, 10)))}>Semana actual</button></div>}
    <div className="sf-objective-control"><label>Mes del objetivo<select value={focus} onChange={e => change({ focusMonth: e.target.value })}>{[...new Set([...model.months.map(m => m.key), focus, ...(weekly ? [scope.from.slice(0, 7), scope.to.slice(0, 7)] : [])])].sort().map(m => <option key={m} value={m}>{monthLabel(m)}{model.months.some(row => row.key === m) ? '' : ' · sin calcular'}</option>)}</select></label>{weekly && scope.from.slice(0, 7) !== scope.to.slice(0, 7) && <div className="sf-inline-links"><span>Semana entre dos meses:</span>{[scope.from.slice(0, 7), scope.to.slice(0, 7)].map(m => <Link key={m} to={to('team', { focusMonth: m })}>Objetivos de {monthLabel(m)}</Link>)}</div>}</div>
    <div className="sf-metrics sf-four sf-forecast-metrics"><TeamAttention {...props} month={focus} /><Metric label={demand.unknown.length ? 'Subtotal turístico conocido' : 'Trabajo turístico conocido'} value={hours(demand.known)} note={demand.unknown.length ? <Link to={to('shifts', { ...scopeQuery(scope), filter: 'unknown-duration' })}>{countLabel(demand.unknown.length, 'tarea')} sin duración · total pendiente</Link> : 'Duración de las tareas registradas'} /><Metric label={demand.unknown.length ? (hasReserve ? 'Subtotal con reserva' : 'Reserva sobre subtotal conocido') : hasReserve ? weekly ? 'Total semanal con reserva' : 'Total con reserva' : 'Reserva adicional estimada'} value={hours(hasReserve ? demand.known * 1.2 : demand.reserve)} note={(demand.unknown.length ? 'Subtotal; faltan duraciones. ' : '') + (hasReserve ? hours(demand.known) + ' + ' + hours(demand.reserve) + ' de reserva' : '+20 % sobre turismo · no activada')} /><Metric label="Tareas por revisar" value={reviewTasks.length} note="Conflictos del registro y encajes pendientes" to={to('shifts', { ...scopeQuery(scope), filter: 'uncovered' })} /></div>
    <Panel title={weekly ? 'Trabajo conocido por día' : 'Evolución por semana'}><ForecastChart rows={chartRows} reserve={!weekly && hasReserve} reinforcement={Number(params.get('refuerzo')) > 0} />
      {demand.unknown.length > 0 && <p className="sf-caption">No se puede cerrar el total: faltan duraciones en {countLabel(demand.unknown.length, 'tarea')}.</p>}
      <details className="sf-detail-block"><summary>Cómo se calcula</summary><p>La capacidad del equipo es una referencia de horas; el encaje de cada tarea en su ventana determina qué puede resolverse. Los otros servicios reducen disponibilidad y no se añaden a la demanda turística.</p><p>La reserva del 20 % se calcula una vez sobre turismo. No crea tareas ni se distribuye entre días. Las horas pasadas no confirman ejecución.</p><p>{lastTask ? 'Última tarea registrada: ' + fullDate(lastTask.date) + '.' : 'No hay tareas registradas.'} Las reservas futuras aún no recibidas no forman parte de esta previsión.</p></details>
      {weekly && <ForecastCapacityBreakdown {...props} scope={scope} />}
    </Panel>
    <Panel title={weekly ? 'Detalle de los siete días' : 'Trabajo por resolver desde hoy'}>
      {weekly && !tasks.length && <p className="sf-caption">Sin tareas turísticas registradas en esta semana y centro. Esto no confirma la ocupación definitiva ni descarta reservas futuras.</p>}
      {!weekly && <p className="sf-caption">{countLabel(attention.upcoming.length, 'día')} con trabajo pendiente. Ordenados por fecha límite; los motivos indican qué revisar.</p>}
      <div className="sf-day-list">{weekly ? days.map(d => dayRow(d)) : attention.upcoming.slice(0, params.get('allDays') === '1' ? undefined : 10).map(d => dayRow(d, d.reasons))}</div>
      {!weekly && !attention.upcoming.length && <Empty>No hay tareas próximas pendientes identificadas en este periodo. La ausencia de registros no confirma la ocupación futura.</Empty>}
      {!weekly && attention.upcoming.length > 10 && <div className="sf-panel-actions"><button onClick={() => change({ allDays: params.get('allDays') === '1' ? '' : '1' })}>{params.get('allDays') === '1' ? 'Mostrar los primeros 10 días' : 'Ver todos los días · ' + attention.upcoming.length}</button></div>}
      {!weekly && attention.past.length > 0 && <details className="sf-detail-block"><summary>Registros anteriores por revisar · {countLabel(attention.past.length, 'día')}</summary><div className="sf-day-list">{attention.past.map(d => dayRow(d, d.reasons))}</div></details>}
      <div className="sf-panel-actions">{tasks.some(t => !t.workerId) && <Link className="sf-button" to={to('shifts', { ...scopeQuery(scope), filter: 'pending' })}>{countLabel(tasks.filter(t => !t.workerId).length, 'tarea')} sin asignar · ver candidatos</Link>}<Link to={to('team', { filter: 'unknown', focusMonth: focus })}>{countLabel(teamSummary(model, focus).unknown.length, 'persona')} por verificar en {monthLabel(focus)}</Link></div>
    </Panel>
    {!weekly && <Panel title="Resumen por mes natural">
      <div className="sf-month-summaries">{model.months.map(m => { const total = demandSummary(model.tasks.filter(t => t.date.startsWith(m.key))); return <article key={m.key}><h3>{monthLabel(m.key)}</h3><dl><div><dt>{total.unknown.length ? 'Subtotal conocido' : 'Trabajo conocido'}</dt><dd>{hours(total.known)}</dd></div><div><dt>{total.unknown.length ? 'Subtotal con reserva' : 'Total con reserva'}</dt><dd>{hours(total.known * 1.2)}</dd></div></dl>{total.unknown.length > 0 && <p>{countLabel(total.unknown.length, 'tarea')} sin duración · total pendiente</p>}{monthlyTeam(m.key)}<details><summary>Desglose y evaluación</summary><p>Reserva adicional: {hours(total.reserve)}. <Badge>{coverageLabel(model, viewScope(model.context, new URLSearchParams({ focusMonth: m.key })))}</Badge></p></details><Link className="sf-button" to={to('shifts', { view: 'month', focusMonth: m.key, date: '', filter: '' })}>Ver días de {monthLabel(m.key)}</Link></article>; })}</div>
      <div className="sf-table-scroll sf-month-desktop"><table><caption>Meses naturales; la reserva no duplica tareas de semanas partidas</caption><thead><tr><th>Mes</th><th>Trabajo conocido</th><th>Reserva</th><th>Total con reserva</th><th>Objetivos del equipo</th><th>Acción</th></tr></thead><tbody>{model.months.map(m => { const total = demandSummary(model.tasks.filter(t => t.date.startsWith(m.key))); return <tr key={m.key}><th>{monthLabel(m.key)}</th><td>{hours(total.known)}{total.unknown.length > 0 && <small>Subtotal · {total.unknown.length} sin duración</small>}</td><td>{hours(total.reserve)}</td><td>{Number.isFinite(total.total) ? hours(total.total * 1.2) : 'Total pendiente'}</td><td>{monthlyTeam(m.key)}</td><td><Link to={to('shifts', { view: 'month', focusMonth: m.key, date: '', filter: '' })}>Ver días</Link></td></tr>; })}</tbody></table></div>
    </Panel>}
  </>;
}

export function SimulationResult(props: ScreenProps & { scope: ViewScope; hoursPerWeek: number }) {
  const { model, base, scope, hoursPerWeek } = props;
  if (!base) return <Panel title="Resultado de la simulación"><Empty>La comparación con el equipo actual no está disponible. Reintenta el cálculo.</Empty></Panel>;
  const delta = simulationChanges(base, model, scope);
  const proposals = model.placements.filter(p => !p.real && p.workerId === 'hypothetical' && within(p.date, scope) && (!model.context.center || p.centerId === model.context.center)).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start || a.taskId.localeCompare(b.taskId));
  const used = sumKnown(proposals, p => p.minutes);
  const weekCount = new Set(model.days.filter(d => within(d.date, scope)).map(d => monday(d.date))).size;
  const team = base.placements.filter(p => !p.real && within(p.date, scope) && (!model.context.center || p.centerId === model.context.center));
  return <Panel title="Comparación del refuerzo con el equipo actual">
    <p className={'sf-simulation-outcome ' + (!delta.improved.length ? 'sf-no-gain' : '')}>{delta.improved.length ? countLabel(delta.improved.length, 'tarea') + ' adicional' + (delta.improved.length === 1 ? '' : 'es') + ' con encaje hipotético' : 'El refuerzo no aporta encajes adicionales con los datos disponibles.'}</p>
    <div className="sf-metrics sf-four"><Metric label="Sin encaje antes" value={delta.before.length} note={hours(demandSummary(delta.before).known)} /><Metric label="Sin encaje después" value={delta.remaining.length} note={hours(demandSummary(delta.remaining).known)} /><Metric label="Horas del refuerzo utilizadas" value={hours(used)} note={countLabel(proposals.length, 'tarea') + ' con encaje hipotético'} /><Metric label="Límite de horas sin utilizar" value={hours(Math.max(0, hoursPerWeek * 60 * weekCount - used))} note={hours(hoursPerWeek * 60) + ' × ' + countLabel(weekCount, 'semana') + '; límite, sin reparto diario'} /></div>
    <p className="sf-caption">{delta.before.length} pendientes − {delta.reinforcement.length} resueltas por refuerzo − {delta.team.length} por reorganización del equipo + {delta.lost.length} que pierden encaje = {delta.remaining.length} pendientes. Se conservan {countLabel(team.length, 'propuesta')} del equipo actual. Ninguna se guarda.</p>
    <p className="sf-caption">Conflictos del registro: {delta.conflicts.length}; tareas sin duración: {delta.incomplete.length}. Pueden coincidir con tareas encajables y no desaparecen hasta revisar el registro. La tarjeta «Tareas por revisar» incluye esos motivos.</p>
    <details className="sf-detail-block"><summary>Ver propuestas del refuerzo por fecha y hora</summary>{[...new Set(proposals.map(p => p.date))].map(date => <section key={date}><h3>{shortDay(date)} · {hours(sumKnown(proposals.filter(p => p.date === date), p => p.minutes))}</h3><TaskList {...props} tasks={proposals.filter(p => p.date === date).flatMap(p => model.tasks.filter(t => t.id === p.taskId))} /></section>)}{!proposals.length && <Empty>El refuerzo no encuentra encajes adicionales con las ventanas y los datos disponibles.</Empty>}</details>
    <details className="sf-detail-block"><summary>Trabajo que sigue pendiente · {delta.remaining.length} tareas</summary><p className="sf-caption">Los detalles indican los datos o conflictos conocidos. Si los datos son válidos, no se ha encontrado un intervalo suficiente con la jornada, disponibilidad y prioridades actuales.</p><TaskList {...props} tasks={delta.remaining} /></details>
  </Panel>;
}
