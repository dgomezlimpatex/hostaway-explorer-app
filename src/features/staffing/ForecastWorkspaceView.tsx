import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Home, CalendarDays, UsersRound, Clock3, Building2, BarChart3, Settings2, Menu, SlidersHorizontal } from 'lucide-react';
import { buildForecastModel } from './forecastModel';
import { hours, monthLabel, monday, forecastLink, validDate, type ForecastContext, type ForecastDataset, type ForecastScreen } from './forecastContract';
import { closeForecastDetail, focusMonth, fullDate, groupIssues, horizonScope, scopedIssues, sourceLabel, viewScope, type ViewScope } from './forecastPresentation';
import { CenterPicker, ForecastDialog, Issues, Panel, type LinkTo } from './ForecastUi';
import { ForecastHome, ForecastSummary, SimulationResult } from './ForecastOverview';
import { Team, Shifts, Centers } from './ForecastOperations';
import { Reports, Settings } from './ForecastReports';
import { ForecastDetails } from './ForecastDetails';
import type { ForecastCalculation } from './forecastCompute';
import './forecast.css';

const navigation: { key: ForecastScreen; label: string; icon: typeof Home }[] = [
  { key: 'home', label: 'Inicio', icon: Home }, { key: 'forecast', label: 'Previsión', icon: CalendarDays }, { key: 'team', label: 'Equipo', icon: UsersRound }, { key: 'shifts', label: 'Cobertura diaria', icon: Clock3 }, { key: 'centers', label: 'Centros', icon: Building2 }, { key: 'reports', label: 'Informes', icon: BarChart3 }, { key: 'settings', label: 'Reglas y datos', icon: Settings2 },
];
interface ViewProps { screen: ForecastScreen; context: ForecastContext; sedeName: string; sedeControl?: ReactNode; dataset?: ForecastDataset; loading?: boolean; error?: string; refresh?: () => void; cancel?: () => void; calculation?: ForecastCalculation }
export function ForecastWorkspaceView(props: ViewProps) {
  const { screen, context, dataset, sedeName } = props;
  const [params, setParams] = useSearchParams();
  const reinforcement = Number(params.get('refuerzo') ?? 0);
  const contextKey = JSON.stringify(context);
  const result = useMemo<ForecastCalculation>(() => {
    if (!dataset) return {};
    if (props.calculation) return props.calculation;
    try { return { model: buildForecastModel(dataset, context, reinforcement), base: reinforcement ? buildForecastModel(dataset, context) : undefined }; }
    catch (error) { return { error: error instanceof Error ? error.message : 'No se pudo calcular el resultado.' }; }
    // Serialized context includes every calculation input and the Madrid reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset, contextKey, reinforcement, props.calculation]);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [mobileMenu, setMobileMenu] = useState(false), [filters, setFilters] = useState(false);
  const [notice, setNotice] = useState('');
  const selectedMonth = focusMonth(context, params);
  const to: LinkTo = (target, extra = {}) => {
    const retained: Record<string, string> = target === screen ? Object.fromEntries(params) : { focusMonth: selectedMonth };
    return forecastLink(target, context, { ...retained, ...(reinforcement ? { refuerzo: String(reinforcement) } : {}), ...extra });
  };
  const change = (values: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(values).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    next.set('sede', context.sedeId);
    ['task', 'person', 'detail'].forEach(key => { if (!(key in values)) next.delete(key); });
    if (['month', 'horizon', 'center'].some(key => key in values) && reinforcement) {
      ['refuerzo', 'simFrom', 'simTo'].forEach(key => next.delete(key));
      setNotice('Refuerzo retirado al cambiar el periodo o el centro. Puedes simularlo en el nuevo contexto.');
    }
    setParams(next);
  };
  const incomplete = dataset?.sources.some(s => s.status === 'unavailable');
  const model = !props.loading && !props.error && !result.pending && !result.error && !incomplete ? result.model : undefined;
  const scope = screen === 'forecast' ? params.get('view') === 'week' ? viewScope(context, params) : horizonScope(context) : screen === 'shifts' ? viewScope(context, params, 'week') : viewScope(context, new URLSearchParams({ focusMonth: selectedMonth }));
  const missingMonth = model && !model.months.some(m => m.key === selectedMonth);
  const missingScreenMonth = missingMonth && screen !== 'forecast' && screen !== 'settings' && !(screen === 'shifts' && scope.mode !== 'month');
  const [simulation, setSimulation] = useState<ViewScope | null>(null), [newHours, setNewHours] = useState('15'), [formError, setFormError] = useState('');
  const simScope = context.reinforcementFrom && context.reinforcementTo ? { from: context.reinforcementFrom, to: context.reinforcementTo, mode: 'simulation', label: `${fullDate(context.reinforcementFrom)} – ${fullDate(context.reinforcementTo)}` } : horizonScope(context);
  const openSimulation = (scopeToUse = scope) => { setNewHours(reinforcement ? String(reinforcement) : '15'); setFormError(''); setSimulation(scopeToUse); };
  const screenProps = model && dataset ? { dataset, model, to, params, change, screen, base: result.base } : undefined;
  return <div className="sf-workspace" onKeyDown={e => { if (e.key === 'Escape' && mobileMenu) { setMobileMenu(false); menuButton.current?.focus(); } }}>
    <a className="sf-skip-link" href="#forecast-content">Ir al contenido</a>
    <header className="sf-topbar"><Link to={to('home')} className="sf-logo"><span className="sf-logo-mark">L</span>LIMPATEX</Link><div className="sf-account">{props.sedeControl ?? <span><Building2 size={16} /> {sedeName}</span>}<span className="sf-readonly">Consulta y simulación</span></div><button ref={menuButton} className="sf-mobile-toggle" aria-expanded={mobileMenu} aria-controls="forecast-nav" onClick={() => setMobileMenu(!mobileMenu)}><Menu size={20} /> Menú</button></header>
    <aside className={`sf-sidebar ${mobileMenu ? 'sf-open' : ''}`}><nav id="forecast-nav" aria-label="Navegación del previsor">{navigation.map(({ key, label, icon: Icon }) => <Link key={key} to={to(key)} onClick={() => setMobileMenu(false)} aria-current={screen === key ? 'page' : undefined}><Icon size={19} /><span>{label}</span></Link>)}</nav><span className="sf-sidebar-foot">Previsor de personal</span></aside>
    <main className="sf-main" id="forecast-content" tabIndex={-1}>
      <div className="sf-page-heading"><div><h1>{navigation.find(n => n.key === screen)?.label}</h1><p className="sf-context">{screen === 'team' ? `Objetivos de ${monthLabel(selectedMonth)}` : screen === 'settings' ? 'Criterios de cálculo y calidad de los registros' : scope.label}</p><p>{context.center ? dataset?.centers.find(c => c.id === context.center)?.name ?? 'Centro por revisar' : 'Todos los centros'}</p></div><button className="sf-mobile-toggle" aria-expanded={filters} aria-controls="forecast-filters" onClick={() => setFilters(!filters)}><SlidersHorizontal size={18} /> Filtrar</button></div>
      <div id="forecast-filters" className={`sf-controls ${filters ? 'sf-open' : ''}`}>
        {screen !== 'settings' && <>{screen === 'forecast' ? <><label>Mes de inicio<input type="month" aria-label="Mes de inicio" value={context.month} onChange={e => { if (validDate(`${e.target.value}-01`)) change({ month: e.target.value, focusMonth: '', date: '', week: monday(`${e.target.value}-01`) }); }} /></label>{screen === 'forecast' && <label>Horizonte<select value={context.horizon} onChange={e => change({ horizon: e.target.value })}>{[1, 3, 6].map(n => <option key={n} value={n}>{n} {n === 1 ? 'mes' : 'meses'}</option>)}</select></label>}</> : <label>{screen === 'team' ? 'Mes del objetivo' : 'Mes de consulta'}<select value={selectedMonth} onChange={e => change({ focusMonth: e.target.value, date: '', week: monday(`${e.target.value}-01`) })}>{missingMonth && <option value={selectedMonth}>{monthLabel(selectedMonth)} · sin calcular</option>}{(model?.months ?? [{ key: context.month }]).map(m => <option key={m.key} value={m.key}>{monthLabel(m.key)}</option>)}</select></label>}<CenterPicker dataset={dataset} value={context.center} onChange={value => change({ center: value })} />{context.center && <button onClick={() => change({ center: '' })}>Quitar centro</button>}</>}
        {screen === 'forecast' && <button onClick={() => change({ month: context.asOf.slice(0, 7), horizon: '3', week: monday(context.asOf.slice(0, 10)), focusMonth: '', view: '', date: '' })}>Próximos tres meses</button>}
        {props.loading || result.pending ? props.cancel && <button onClick={props.cancel}>Cancelar consulta</button> : props.refresh && <button onClick={props.refresh}>{props.error || result.error || incomplete ? 'Reintentar' : 'Actualizar datos'}</button>}
      </div>
      {notice && <div role="status" className="sf-notice"><p>{notice}</p><button onClick={() => setNotice('')}>Entendido</button></div>}
      {props.loading && <div role="status" className="sf-loading">Leyendo datos de {sedeName}…</div>}
      {!props.loading && result.pending && <div role="status" className="sf-loading">Calculando encajes para el contexto seleccionado…</div>}
      {(props.error || result.error) && <p className="sf-notice sf-red" role="alert">{props.error || result.error} No se muestran resultados anteriores. Pulsa Reintentar para volver a consultar.</p>}
      {incomplete && dataset && <Panel title="No se pudieron leer todos los datos"><p className="sf-caption" role="alert">Los totales están pendientes de verificar. Pulsa Reintentar para recuperar las fuentes pendientes.</p><ul className="sf-source-list">{dataset.sources.map(s => <li key={s.name}>{sourceLabel(s.name)}: {s.status === 'unavailable' ? 'Lectura no disponible' : `${s.count} registros leídos`}</li>)}</ul></Panel>}
      {screenProps && <>
        {scopedIssues(model, scope).length > 0 && screen !== 'settings' && <details className="sf-quality"><summary>{groupIssues(scopedIssues(model, scope)).length} causas por revisar en este ámbito</summary><Issues {...screenProps} scope={scope} compact /></details>}
        {reinforcement > 0 && <div className="sf-notice sf-simulation"><div><strong>Simulación activa · refuerzo de {hours(reinforcement * 60)}/semana</strong><p>{simScope.label} · {context.center ? dataset.centers.find(c => c.id === context.center)?.name : 'Todos los centros'}.</p><small>Capacidad hipotética flexible en las ventanas de las tareas. Reserva: {context.scenario === 'reserve' ? '+20 % activado' : 'sin activar'}.</small></div><div className="sf-inline-links"><button onClick={() => openSimulation(simScope)}>Editar simulación</button><button onClick={() => change({ refuerzo: '', simFrom: '', simTo: '' })}>Volver a situación actual</button></div></div>}
        {reinforcement > 0 && (screen === 'forecast' || screen === 'shifts') && <SimulationResult {...screenProps} scope={simScope} hoursPerWeek={reinforcement} />}
        {missingScreenMonth ? <Panel title="Este mes no está calculado"><p className="sf-caption">{monthLabel(selectedMonth)} queda fuera del horizonte leído. No se muestran ceros ni totales de un mes incompleto.</p><div className="sf-panel-actions"><button onClick={() => change({ month: selectedMonth, horizon: '1', focusMonth: selectedMonth, week: monday(`${selectedMonth}-01`), date: '' })}>Consultar este mes completo</button><button onClick={() => change({ focusMonth: context.month })}>Volver al mes cargado</button></div></Panel> : <>
          {screen === 'home' && <ForecastHome {...screenProps} />}
          {screen === 'forecast' && <ForecastSummary {...screenProps} onSimulate={() => openSimulation()} />}
          {screen === 'team' && <Team {...screenProps} />}
          {screen === 'shifts' && <Shifts {...screenProps} onSimulate={() => openSimulation()} />}
          {screen === 'centers' && <Centers {...screenProps} />}
          {screen === 'reports' && <Reports {...screenProps} sedeName={sedeName} />}
          {screen === 'settings' && <Settings {...screenProps} />}
        </>}
        <footer className="sf-footer">Datos actualizados a las {new Date(dataset.fetchedAt).toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' })}<details><summary>Detalles técnicos de la consulta</summary><p>Lectura: {new Date(dataset.fetchedAt).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}. Cómputo de horas a fecha: {context.asOf.replace('T', ' ')} (Europe/Madrid). Reglas: {dataset.rulesVersion}.</p></details></footer>
        <ForecastDetails {...screenProps} close={() => setParams(closeForecastDetail(params))} />
      </>}
      {simulation && <ForecastDialog title="Simular refuerzo" description={`${sedeName} · ${simulation.label} · ${context.center ? dataset?.centers.find(c => c.id === context.center)?.name : 'Todos los centros'}`} close={() => setSimulation(null)}><form noValidate onSubmit={e => { e.preventDefault(); const raw = newHours.trim(); const value = Number(raw.replace(',', '.')); if (!/^\d+(?:[.,]\d+)?$/.test(raw) || !(value > 0) || !Number.isFinite(value * 60 * 4.345)) { setFormError('Indica horas positivas; por ejemplo, 15 o 15,5.'); return; } change({ refuerzo: String(value), simFrom: simulation.from, simTo: simulation.to }); setSimulation(null); }}>
        <label>Horas semanales<input inputMode="decimal" value={newHours} onChange={e => { setNewHours(e.target.value); setFormError(''); }} aria-invalid={!!formError} aria-describedby="refuerzo-help refuerzo-error" /></label><p id="refuerzo-help">Se prueba primero el equipo actual, incluido el margen semanal hasta el 130 %. El refuerzo es una persona flexible durante estas fechas, sin libranza impuesta.</p><p id="refuerzo-error" role={formError ? 'alert' : undefined}>{formError}</p><button className="sf-primary" type="submit">Ver simulación</button><p>Las propuestas se revisan antes de asignarlas en el calendario. Esta simulación no guarda cambios.</p>
      </form></ForecastDialog>}
    </main>
  </div>;
}
