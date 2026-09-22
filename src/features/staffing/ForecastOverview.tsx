import { Link } from 'react-router-dom';
import { addCivilDays } from './monthly';
import { hours, dateLabel, monthLabel, monday } from './forecastContract';
import { coverageLabel, countLabel, dayNames, focusMonth, fullDate, horizonScope, scopeQuery, scopedTasks, sumComplete, sumKnown, teamSummary, viewScope, within, type ViewScope } from './forecastPresentation';
import { Badge, Empty, ForecastChart, Metric, Panel, TaskList, type ScreenProps } from './ForecastUi';

export function ForecastHome(props: ScreenProps) {
  const { model, to, params } = props;
  const scope = viewScope(model.context, new URLSearchParams({ focusMonth: focusMonth(model.context, params) }));
  const team = teamSummary(model, scope.from.slice(0, 7));
  const tasks = scopedTasks(model, scope, 'pending');
  const today = model.context.asOf.slice(0, 10);
  const start = within(today, scope) ? today : scope.from;
  const week = model.days.filter(d => d.date >= start && d.date <= addCivilDays(start, 6) && within(d.date, scope));
  const review = model.days.filter(d => within(d.date, scope) && scopedTasks(model, { ...scope, from: d.date, to: d.date }, 'uncovered').length > 0);
  return <>
    <Panel title="Pendiente de revisar"><div className="sf-worklist">
      {model.issues.some(i => i.impact !== 'information') && <Link to={to('settings', { tab: 'data' })}><div><strong>Revisar datos que impiden cerrar la previsión</strong><p>Las causas están agrupadas con las personas, tareas y centros afectados.</p></div><span>Revisar datos →</span></Link>}
      {tasks.length > 0 && <Link to={to('shifts', { ...scopeQuery(scope), filter: 'pending' })}><div><strong>{countLabel(tasks.length, 'tarea')} sin asignar</strong><p>{scope.label} · la primera es del {fullDate(tasks[0].date)}.</p></div><span>Revisar tareas →</span></Link>}
      {team.risk.length > 0 && <Link to={to('team', { filter: 'risk', focusMonth: scope.from.slice(0, 7) })}><div><strong>{countLabel(team.risk.length, 'persona')} con horas por completar</strong><p>{hours(sumKnown(team.risk, l => l.missing))} pendientes sobre objetivos verificables de {monthLabel(scope.from.slice(0, 7))}.</p></div><span>Revisar equipo →</span></Link>}
      {team.unknown.length > 0 && <Link to={to('team', { filter: 'unknown', focusMonth: scope.from.slice(0, 7) })}><div><strong>{countLabel(team.unknown.length, 'persona')} pendiente{team.unknown.length === 1 ? '' : 's'} de evaluación</strong><p>Su saldo mensual todavía no se puede confirmar.</p></div><span>Ver personas →</span></Link>}
      {!tasks.length && !team.risk.length && !team.unknown.length && !model.issues.length && <Empty>No hay pendientes identificados con los registros de este periodo.</Empty>}
    </div></Panel>
    <div className="sf-metrics sf-three"><Metric label="Tareas sin asignar" value={tasks.length} note={scope.label} to={to('shifts', { ...scopeQuery(scope), filter: 'pending' })} /><Metric label="Personas con horas pendientes" value={team.risk.length} note={`${team.unknown.length} pendientes de verificar por separado`} to={to('team', { filter: 'risk', focusMonth: scope.from.slice(0, 7) })} /><Metric label="Días con tareas por revisar" value={review.length} note={scope.label} to={to('shifts', { ...scopeQuery(scope), filter: 'uncovered' })} /></div>
    <Panel title={`Siete días desde el ${dateLabel(start)}`}><div className="sf-day-grid">{week.map(day => <Link key={day.date} to={to('shifts', { view: 'day', date: day.date, focusMonth: day.date.slice(0, 7), week: monday(day.date) })}><strong>{dayNames[new Date(`${day.date}T12:00Z`).getUTCDay()]}</strong><span>{dateLabel(day.date)}</span><b>{hours(day.known)}</b><small>{day.unassigned} sin asignar</small><Badge>{coverageLabel(model, { ...scope, from: day.date, to: day.date })}</Badge></Link>)}</div></Panel>
    <div className="sf-inline-links"><Link className="sf-button" to={to('forecast')}>Ver previsión completa</Link><Link className="sf-button" to={to('team')}>Consultar equipo</Link></div>
  </>;
}

export function ForecastSummary(props: ScreenProps & { onSimulate: () => void }) {
  const { model, params, to, change, onSimulate } = props;
  const weekly = params.get('view') === 'week';
  const scope = weekly ? viewScope(model.context, params) : horizonScope(model.context);
  const days = model.days.filter(d => within(d.date, scope));
  const tasks = scopedTasks(model, scope);
  const reviewTasks = scopedTasks(model, scope, 'uncovered');
  const focus = focusMonth(model.context, params);
  const hasMonth = model.months.some(m => m.key === focus);
  const team = teamSummary(model, focus);
  const reserve = sumComplete(days, d => d.tourism) * .2;
  const weekIndex = model.weeks.findIndex(w => w.key === model.context.week);
  const changeWeek = (week: string) => change({ week, focusMonth: '', date: '', view: 'week' });
  const lastTask = [...model.tasks].sort((a, b) => b.date.localeCompare(a.date))[0];
  const phase = (from: string, to: string) => to < model.context.asOf.slice(0, 10) ? 'Pasado' : from > model.context.asOf.slice(0, 10) ? 'Futuro' : 'Incluye fecha de consulta';
  const chartRows = weekly ? days.map(d => ({ ...d, key: dateLabel(d.date), label: fullDate(d.date), phase: phase(d.date, d.date), reserve: 0 })) : model.weeks.map(w => {
    // The horizon is natural months. Boundary weeks show only their included days.
    const inMonth = days.filter(d => monday(d.date) === w.key);
    return { key: dateLabel(w.key), label: `Semana del ${fullDate(w.key)} (días dentro del horizonte)`, phase: phase(inMonth[0]?.date ?? w.key, inMonth.at(-1)?.date ?? addCivilDays(w.key, 6)), known: sumComplete(inMonth, d => d.known), capacity: sumComplete(inMonth, d => d.capacity), reserve: sumComplete(inMonth, d => d.tourism) * .2 };
  });
  return <>
    <div className="sf-toolbar"><div className="sf-segment"><button aria-pressed={!weekly} onClick={() => change({ view: '', date: '' })}>Resumen mensual</button><button aria-pressed={weekly} onClick={() => change({ view: 'week', focusMonth: '', date: '' })}>Detalle semanal</button></div><div className="sf-segment"><button aria-pressed={model.context.scenario === 'known'} onClick={() => change({ scenario: 'known' })}>Trabajo conocido</button><button aria-pressed={model.context.scenario === 'reserve'} onClick={() => change({ scenario: 'reserve' })}>Con reserva +20 %</button></div><button className="sf-primary" onClick={onSimulate}>Simular refuerzo</button></div>
    {weekly && <div className="sf-toolbar"><button disabled={weekIndex <= 0} onClick={() => changeWeek(model.weeks[weekIndex - 1].key)}>Semana anterior</button><label>Semana<select value={model.context.week} onChange={e => changeWeek(e.target.value)}>{model.weeks.map(w => <option key={w.key} value={w.key}>{fullDate(w.key)} – {fullDate(addCivilDays(w.key, 6))}</option>)}</select></label><button disabled={weekIndex >= model.weeks.length - 1} onClick={() => changeWeek(model.weeks[weekIndex + 1].key)}>Semana siguiente</button><button disabled={!model.weeks.some(w => w.key === monday(model.context.asOf.slice(0, 10)))} onClick={() => changeWeek(monday(model.context.asOf.slice(0, 10)))}>Semana actual</button></div>}
    <div className="sf-context-line"><strong>{scope.label}</strong><Badge>{coverageLabel(model, scope)}</Badge></div>
    <div className="sf-metrics sf-four"><Metric label="Trabajo turístico conocido" value={hours(sumComplete(days, d => d.tourism))} note={scope.label} /><Metric label="Reserva adicional estimada" value={hours(reserve)} note={model.context.scenario === 'reserve' ? '+20 % sobre turismo, añadido una sola vez' : 'Referencia · no activada'} /><Metric label="Tareas por revisar" value={reviewTasks.length} note="Incluye conflictos y encajes pendientes" to={to('shifts', { ...scopeQuery(scope), filter: 'uncovered' })} /><Metric label="Personas con horas pendientes" value={hasMonth ? team.risk.length : 'Sin calcular'} note={hasMonth ? `${monthLabel(focus)} · ${team.unknown.length} por verificar` : `${monthLabel(focus)} queda fuera del horizonte cargado`} to={to('team', { focusMonth: focus, filter: 'risk' })} /></div>
    <Panel title={weekly ? 'Trabajo conocido por día' : 'Evolución por semana'}><ForecastChart rows={chartRows} reserve={!weekly && model.context.scenario === 'reserve'} /><p className="sf-caption">La capacidad es una referencia de horas. Solo el encaje de cada tarea en su ventana permite verificar la cobertura. El mantenimiento reduce la disponibilidad individual y no se añade a esta demanda.</p>{weekly && <p className="sf-caption">Reserva de la semana: {hours(reserve)}. Se mantiene separada del trabajo diario; no crea tareas ni se reparte entre días.</p>}<p className="sf-caption">{lastTask ? `Última tarea registrada en el periodo leído: ${fullDate(lastTask.date)}.` : 'No hay tareas registradas en el periodo leído.'} Las fechas lejanas pueden tener reservas aún sin recibir; menos registros no confirman menos trabajo.</p></Panel>
    <Panel title={weekly ? 'Detalle de los siete días' : 'Días que requieren atención'}><div className="sf-day-list">{(weekly ? days : days.filter(d => reviewTasks.some(t => t.date === d.date) || d.unassigned).slice(0, 10)).map(day => <div key={day.date}><strong>{fullDate(day.date)}</strong><span>{hours(day.known)} conocidas · {day.unassigned} sin asignar</span><Badge>{coverageLabel(model, { ...scope, from: day.date, to: day.date })}</Badge><Link to={to('shifts', { view: 'day', date: day.date, focusMonth: day.date.slice(0, 7), week: monday(day.date), filter: '' })}>Ver tareas del día</Link></div>)}</div>{!weekly && !reviewTasks.length && !tasks.some(t => !t.workerId) && <Empty>No se han identificado tareas que requieran revisión. Consulta los avisos para conocer los límites de evaluación.</Empty>}<div className="sf-panel-actions"><Link className="sf-button" to={to('shifts', { ...scopeQuery(scope), filter: 'pending' })}>{countLabel(tasks.filter(t => !t.workerId).length, 'tarea')} sin asignar · ver candidatos</Link><Link to={to('team', { filter: 'unknown', focusMonth: focus })}>{countLabel(team.unknown.length, 'persona')} por verificar en {monthLabel(focus)}</Link></div></Panel>
    {!weekly && <Panel title="Resumen por mes natural"><div className="sf-table-scroll"><table><caption>Reserva calculada una sola vez sobre las tareas turísticas de cada mes</caption><thead><tr><th>Mes</th><th>Trabajo conocido</th><th>Reserva adicional</th><th>Total con reserva</th><th>Evaluación</th><th>Acción</th></tr></thead><tbody>{model.months.map(m => <tr key={m.key}><th>{monthLabel(m.key)}</th><td>{hours(m.known)}</td><td>{hours(m.reserve)}</td><td>{hours(m.known + m.reserve)}</td><td><Badge>{coverageLabel(model, viewScope(model.context, new URLSearchParams({ focusMonth: m.key })))}</Badge></td><td><Link to={to('shifts', { view: 'month', focusMonth: m.key, date: '', filter: '' })}>Ver días</Link></td></tr>)}</tbody></table></div></Panel>}
  </>;
}

export function SimulationResult(props: ScreenProps & { scope: ViewScope; hoursPerWeek: number }) {
  const { model, base, scope, hoursPerWeek } = props;
  if (!base) return <Panel title="Resultado de la simulación"><Empty>La comparación con el equipo actual no está disponible. Reintenta el cálculo.</Empty></Panel>;
  const original = base.days.filter(d => within(d.date, scope)), simulated = model.days.filter(d => within(d.date, scope));
  const proposals = model.placements.filter(p => !p.real && p.workerId === 'hypothetical' && within(p.date, scope) && (!model.context.center || p.centerId === model.context.center));
  const used = sumKnown(proposals, p => p.minutes);
  const weekCount = new Set(simulated.map(d => monday(d.date))).size;
  const currentProposals = base.placements.filter(p => !p.real && within(p.date, scope) && (!model.context.center || p.centerId === model.context.center));
  const proposalDays = [...new Set(proposals.map(p => p.date))].sort();
  const pending = (result: typeof model) => result.uncoveredTaskIds ? countLabel(result.tasks.filter(t => result.uncoveredTaskIds.includes(t.id) && within(t.date, scope)).length, 'tarea') + ' sin encaje planificado' : 'Recuento de tareas por verificar';
  return <Panel title="Comparación del refuerzo con el equipo actual"><p className="sf-caption">{scope.label}. Misma sede, centros y tareas en ambos escenarios. {coverageLabel(model, scope)}.</p><div className="sf-metrics sf-four"><Metric label="Sin encaje tras probar equipo actual" value={hours(sumComplete(original, d => d.uncovered))} note={pending(base)} /><Metric label="Sin encaje con refuerzo" value={hours(sumComplete(simulated, d => d.uncovered))} note={pending(model)} /><Metric label="Horas del refuerzo utilizadas" value={hours(used)} note={`${countLabel(proposals.length, 'tarea')} con encaje hipotético`} /><Metric label="Límite de horas sin utilizar" value={hours(Math.max(0, hoursPerWeek * 60 * weekCount - used))} note={`${hoursPerWeek} h × ${countLabel(weekCount, 'semana')}; semanas parciales no prorrateadas`} /></div><p className="sf-caption">Con el equipo actual se proponen {countLabel(currentProposals.length, 'encaje')} ({hours(sumKnown(currentProposals, p => p.minutes))}). El refuerzo se intenta después para tareas que permanecen sin encaje. Las horas sin utilizar no garantizan otra tarea viable.</p><details className="sf-detail-block"><summary>Ver propuestas del refuerzo por fecha</summary>{proposalDays.map(date => <section key={date}><h3>{fullDate(date)} · {hours(sumKnown(proposals.filter(p => p.date === date), p => p.minutes))}</h3><TaskList {...props} tasks={model.tasks.filter(t => t.date === date && proposals.some(p => p.taskId === t.id))} /></section>)}{!proposals.length && <Empty>El refuerzo no encuentra encajes adicionales con las ventanas y los datos disponibles.</Empty>}</details></Panel>;
}
