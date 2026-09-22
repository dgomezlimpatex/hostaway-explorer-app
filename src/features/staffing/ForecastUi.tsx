import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronRight, X } from 'lucide-react';
import { clock, hours, type ForecastDataset, type ForecastModel, type ForecastScreen, type ForecastTask } from './forecastContract';
import { affectedRecords, centerKind, centerLabel, countLabel, duration, fullDate, groupIssues, horizonScope, normalize, personName, scopeQuery, scopedIssues, sourceLabel, taskConflicts, type ViewScope } from './forecastPresentation';

export type LinkTo = (screen: ForecastScreen, values?: Record<string, string>) => string;
export type Change = (values: Record<string, string>) => void;
export interface ScreenProps { dataset: ForecastDataset; model: ForecastModel; to: LinkTo; params: URLSearchParams; change: Change; screen: ForecastScreen; base?: ForecastModel }
export function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <section className="sf-panel"><div className="sf-panel-heading"><h2>{title}</h2>{action}</div>{children}</section>;
}
export function Empty({ children = 'No hay registros en este contexto.', reset }: { children?: ReactNode; reset?: () => void }) {
  return <div className="sf-empty"><p>{children}</p>{reset && <button onClick={reset}>Limpiar filtros</button>}</div>;
}
export function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  const value = String(children);
  const state = tone ?? (/incompatible/i.test(value) ? 'red' : /verificar|resolver|pendiente|parcial|incomplet|sin encaje/i.test(value) ? 'amber' : /propuest|simulad/i.test(value) ? 'proposal' : /verificadas|alcanzable/i.test(value) ? 'green' : 'neutral');
  return <span className={`sf-badge sf-${state}`}>{children}</span>;
}
export function Metric({ label, value, note, to }: { label: string; value: ReactNode; note?: ReactNode; to?: string }) {
  const content = <><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}{to && <ChevronRight size={16} aria-hidden="true" />}</>;
  return to ? <Link className="sf-metric" to={to}>{content}</Link> : <div className="sf-metric">{content}</div>;
}
export function ForecastDialog({ title, description, children, close, wide = false }: { title: string; description: string; children: ReactNode; close: () => void; wide?: boolean }) {
  const opener = useRef<HTMLElement | null>(typeof document !== 'undefined' ? document.activeElement as HTMLElement : null);
  return <Dialog.Root open onOpenChange={open => { if (!open) close(); }}><Dialog.Portal><Dialog.Overlay className="sf-modal-overlay" /><Dialog.Content className={`sf-workspace sf-dialog ${wide ? 'sf-wide-dialog' : ''}`} onCloseAutoFocus={event => { if (opener.current?.isConnected) { event.preventDefault(); opener.current.focus(); } }}>
    <div className="sf-dialog-heading"><div><Dialog.Title>{title}</Dialog.Title><Dialog.Description>{description}</Dialog.Description></div><Dialog.Close aria-label="Cerrar detalle"><X size={20} /><span className="sf-sr-only">Cerrar</span></Dialog.Close></div>{children}
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
export function CenterPicker({ dataset, value, onChange }: { dataset?: ForecastDataset; value: string; onChange: (value: string) => void }) {
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDetailsElement>(null);
  const centers = [...(dataset?.centers ?? [])].sort((a, b) => centerLabel(a).localeCompare(centerLabel(b), 'es')).filter(c => normalize(centerLabel(c)).includes(normalize(query)));
  const selected = dataset?.centers.find(c => c.id === value);
  const select = (id: string) => { onChange(id); if (ref.current) { ref.current.open = false; ref.current.querySelector('summary')?.focus(); } setQuery(''); };
  return <div className="sf-center-picker"><span className="sf-field-label">Centro</span><details ref={ref}><summary aria-label={`Centro: ${value ? selected ? centerLabel(selected) : 'Centro no disponible' : 'Todos los centros'}`}>{value ? selected ? centerLabel(selected) : 'Centro no disponible' : 'Todos los centros'}</summary><div className="sf-center-options"><label>Buscar centro<input type="search" value={query} onChange={e => setQuery(e.target.value)} /></label><button onClick={() => select('')} aria-pressed={!value}>Todos los centros</button><div className="sf-option-list">{centers.map(c => <button key={c.id} onClick={() => select(c.id)} aria-pressed={value === c.id}><span>{centerLabel(c)}</span><small>{centerKind(c.id)}</small></button>)}{!centers.length && <p>No hay centros con esta búsqueda.</p>}</div></div></details></div>;
}
export function Issues({ dataset, model, to, compact = false, scope = horizonScope(model.context) }: Pick<ScreenProps, 'dataset' | 'model' | 'to'> & { compact?: boolean; scope?: ViewScope }) {
  const groups = groupIssues(scopedIssues(model, scope));
  return <div className="sf-issues">
    <p className="sf-caption">{scope.label} · {model.context.center ? dataset.centers.find(c => c.id === model.context.center)?.name ?? 'Centro consultado' : 'Toda la sede'}. Los avisos comunes de sede se identifican por separado.</p>
    {!groups.length && <Empty>No hay incidencias registradas en el contexto consultado.</Empty>}
    {groups.map(group => <IssueGroup key={group.code} group={group} dataset={dataset} to={to} today={model.context.asOf.slice(0, 10)} scope={scope} />)}
    {compact && groups.length > 0 && <Link className="sf-button" to={to('settings', { tab: 'data' })}>Abrir datos por revisar</Link>}
  </div>;
}
function IssueGroup({ group, dataset, to, today, scope }: { group: ReturnType<typeof groupIssues>[number]; dataset: ScreenProps['dataset']; to: LinkTo; today: string; scope: ViewScope }) {
  const [open, setOpen] = useState(false);
  const affected = affectedRecords(dataset, group.issues);
  const summary = Object.values(affected).some(records => records.length)
    ? [affected.workers.length && countLabel(affected.workers.length, 'persona'), affected.tasks.length && countLabel(affected.tasks.length, 'tarea'), affected.centers.length && countLabel(affected.centers.length, 'centro'), affected.properties.length && countLabel(affected.properties.length, 'propiedad', 'propiedades')].filter(Boolean).join(' · ')
    : group.issues.some(i => i.ids.length || i.workerId || i.centerId) ? 'Pendientes de identificar' : 'Toda la consulta';
  return <details className="sf-issue-group" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary><span><strong>{group.title}</strong><small>Registros afectados: {summary}</small></span><Badge>{countLabel(group.issues.length, 'aviso')}</Badge></summary>
    {open && <><p>{group.impact}</p><p>{group.issues.some(i => !i.ids.length) ? 'Ámbito común: toda la sede.' : 'Ámbito: solo los registros y fechas indicados.'}</p>{group.code === 'missing-duration' && <Link className="sf-button" to={to('shifts', { ...scopeQuery(scope), filter: 'unknown-duration' })}>Revisar tareas sin duración de este ámbito</Link>}<ul>{[...group.issues].sort((a, b) => {
      const ad = a.date ?? a.from ?? today, bd = b.date ?? b.from ?? today;
      return Number(ad < today) - Number(bd < today) || ad.localeCompare(bd);
    }).map((issue, index) => {
      const records = affectedRecords(dataset, [issue]);
      return <li key={index}><p>{issue.message}</p>{issue.date && <small>{fullDate(issue.date)}</small>}
        {issue.from && <small>{fullDate(issue.from)} – {fullDate(issue.to ?? issue.from)}</small>}
        <div className="sf-inline-links">
          {records.tasks.length ? records.tasks.map(t => <Link key={t.id} to={to('shifts', { task: t.id, date: t.date, focusMonth: t.date.slice(0, 7), view: 'day' })}>{issue.code === 'missing-duration' ? 'Revisar duración: ' : issue.code === 'unmapped-task' ? 'Identificar propiedad: ' : 'Revisar tarea: '}{t.name}</Link>) : records.workers.length ? records.workers.map(w => <Link key={w.id} to={to('team', { person: w.id, ...(issue.date || issue.from ? { focusMonth: (issue.date ?? issue.from)!.slice(0, 7) } : {}) })}>Revisar {personName(w.name)}</Link>) : records.centers.map(c => <Link key={c.id} to={to('centers', { detail: c.id })}>Revisar {centerLabel(c)}</Link>)}
        </div>
        {records.properties.length > 0 && <p>Propiedades: {records.properties.map(p => p.name).join(', ')}. Sus datos se consultan en el centro correspondiente.</p>}
        {!records.workers.length && !records.tasks.length && !records.centers.length && <p>La administración de la sede debe revisar {sourceLabel(issue.source).toLowerCase()}. {issue.code === 'source-unavailable' ? 'Vuelve a actualizar los datos.' : 'Usa la referencia de soporte si no puedes identificar el registro.'}</p>}
        <details><summary>Referencia para soporte</summary><code>{issue.code} · {issue.source} · {issue.ids.join(', ') || 'Toda la consulta'}</code><CopyReference value={issue.message + '\n' + issue.source + ': ' + issue.ids.join(', ')} /></details>
      </li>;
    })}</ul></>}
  </details>;
}
function CopyReference({ value }: { value: string }) {
  const [state, setState] = useState('');
  return <><button onClick={async () => {
    try { await navigator.clipboard.writeText(value); setState('Referencia copiada.'); }
    catch { setState('No se pudo copiar. Selecciona y copia la referencia mostrada.'); }
  }}>Copiar referencia</button>{state && <p role="status">{state}</p>}</>;
}

export function TaskList({ tasks, dataset, model, to, screen, reset, returnTo }: Pick<ScreenProps, 'dataset' | 'model' | 'to' | 'screen'> & { tasks: ForecastTask[]; reset?: () => void; returnTo?: Record<string, string> }) {
  const [limit, setLimit] = useState(25);
  if (!tasks.length) return <Empty reset={reset}>{reset ? 'No hay resultados con estos filtros.' : 'No hay tareas registradas en este periodo.'}</Empty>;
  return <div className="sf-task-list">{tasks.slice(0, limit).map(t => {
    const proposal = model.placements.find(p => p.taskId === t.id && !p.real);
    const conflicts = taskConflicts(t, model);
    const owner = dataset.workers.find(w => w.id === t.workerId);
    const link = { task: t.id, person: '', detail: '', focusMonth: t.date.slice(0, 7), ...returnTo };
    return <article className="sf-task-card" key={t.id}><div><Link className="sf-task-name" to={to(screen, link)}>{t.name}</Link><small>{fullDate(t.date)} · {dataset.centers.find(c => c.id === t.centerId)?.name}</small><span>Duración: {duration(t.minutes)} · Ventana: {clock(t.windowStart)}–{clock(t.windowEnd)}</span></div><div><Badge>{t.ambiguous ? 'Asignación por verificar' : owner ? 'Asignada' : t.workerId ? 'Persona por verificar' : 'Sin asignar'}</Badge>{owner && <p>{personName(owner.name)}</p>}<small>Horario registrado: {clock(t.start)}–{clock(t.end)}{!t.workerId && ' · sin responsable'}</small>{conflicts.length > 0 && <Badge>{conflicts[0]}</Badge>}</div>{proposal && <div className="sf-proposal"><Badge>Propuesta · sin guardar</Badge><p>{personName(model.workers.find(w => w.id === proposal.workerId)?.name ?? 'Persona por verificar')}</p><span>{clock(proposal.start)}–{clock(proposal.end)}</span>{t.workerId && <small>Recomendación de cambio de la asignación existente.</small>}</div>}<div className="sf-inline-links"><Link to={to(screen, link)}>Ver tarea</Link>{!t.workerId && !t.ambiguous && <Link to={to(screen, { ...link, detail: 'candidates' })}>Ver candidatos</Link>}</div></article>;
  })}{tasks.length > limit && <button onClick={() => setLimit(limit + 25)}>Mostrar más · {tasks.length - limit} restantes</button>}</div>;
}
export interface ChartRow { key: string; label: string; known: number; capacity: number; reserve: number; phase?: string; partial?: boolean; reinforcement?: number }
export function ForecastChart({ rows, reserve, reinforcement = false }: { rows: ChartRow[]; reserve: boolean; reinforcement?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  useEffect(() => {
    if (!host.current) return;
    const measure = () => setWidth(Math.max(260, Math.min(1000, host.current!.clientWidth - 20)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const maximum = Math.max(60, ...rows.flatMap(r => [r.known, r.capacity, r.known + (reserve ? r.reserve : 0), r.reinforcement ?? 0].filter(Number.isFinite)));
  const bottom = 212, left = 54, plot = width - left - 12, step = plot / Math.max(1, rows.length);
  const x = (i: number) => left + step * (i + .5), y = (value: number) => bottom - value / maximum * 172;
  const [selected, setSelected] = useState('');
  const active = rows.find(r => r.key === selected);
  const series = [{ value: (r: ChartRow) => r.known, color: '#168486', name: 'Trabajo conocido' }, { value: (r: ChartRow) => r.capacity, color: '#285d94', name: 'Capacidad de referencia del equipo' }, ...(reserve ? [{ value: (r: ChartRow) => r.known + r.reserve, color: '#795719', name: 'Con reserva +20 %' }] : []), ...(reinforcement ? [{ value: (r: ChartRow) => r.reinforcement ?? 0, color: '#75468b', name: 'Trabajo encajado por el refuerzo' }] : [])];
  return <><div ref={host} className="sf-chart-scroll"><svg className="sf-chart" viewBox={'0 0 ' + width + ' 258'} role="img" aria-label="Evolución en horas; tabla de datos disponible debajo.">
    {rows.map((row, i) => row.phase === 'Futuro' && <rect key={'phase-' + row.key} x={left + step * i} y="32" width={step} height={180} fill="#edf4f8"><title>{row.label} · Futuro</title></rect>)}
    {[0, 1, 2, 3, 4].map(n => <g key={n}><line x1={left} x2={width - 8} y1={y(maximum * n / 4)} y2={y(maximum * n / 4)} stroke="#d5e1e8" /><text x={left - 8} y={y(maximum * n / 4) + 5} textAnchor="end">{Math.round(maximum * n / 240)} h</text></g>)}
    {series.map((s, seriesIndex) => <g key={s.name}>{rows.map((row, i) => Number.isFinite(s.value(row)) && <g key={row.key}>{i > 0 && !row.partial && !rows[i - 1].partial && Number.isFinite(s.value(rows[i - 1])) && <line x1={x(i - 1)} y1={y(s.value(rows[i - 1]))} x2={x(i)} y2={y(s.value(row))} stroke={s.color} strokeWidth="2.5" strokeDasharray={seriesIndex > 1 ? '5 4' : undefined} />}<circle tabIndex={0} role="button" aria-label={row.label + ', ' + s.name + ': ' + hours(s.value(row))} onFocus={() => setSelected(row.key)} onClick={() => setSelected(row.key)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(row.key); } }} cx={x(i)} cy={y(s.value(row))} r={row.partial ? 6 : 4} fill={row.partial ? '#fff' : s.color} stroke={s.color} strokeWidth="2"><title>{row.label}: {hours(s.value(row))}</title></circle></g>)}</g>)}
    {rows.map((row, i) => ((i % Math.max(1, Math.ceil(rows.length / Math.max(2, Math.floor(plot / 85)))) === 0 && (rows.length - 1 - i) * step >= 70) || i === rows.length - 1) && <text key={row.key} x={x(i)} y="245" textAnchor={i === rows.length - 1 ? 'end' : 'middle'}>{row.key}{row.partial ? '*' : ''}</text>)}
  </svg></div>
  <div className="sf-legend">{series.map(s => <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>)}<span>Fondo claro: fechas futuras</span></div>
  {rows.some(r => r.partial) && <div className="sf-partial-weeks"><strong>* Semanas parciales · puntos sin unir</strong>{rows.filter(r => r.partial).map(r => <span key={r.key}>{r.label}</span>)}</div>}
  {active && <p className="sf-caption" role="status">{active.label}: trabajo {hours(active.known)} · capacidad {hours(active.capacity)}{reserve && ' · con reserva ' + hours(active.known + active.reserve)}{reinforcement && ' · encajado por refuerzo ' + hours(active.reinforcement ?? 0)}</p>}
  <details className="sf-chart-data"><summary>Consultar tabla de datos del gráfico</summary><div className="sf-table-scroll"><table><caption>Valores del mismo periodo; semanas parciales identificadas por sus días incluidos</caption><thead><tr><th>Periodo</th><th>Momento</th><th>Trabajo conocido</th>{reserve && <th>Con reserva</th>}<th>Capacidad del equipo</th>{reinforcement && <th>Encajado por refuerzo</th>}</tr></thead><tbody>{rows.map(row => <tr key={row.key}><th>{row.label}</th><td>{row.phase ?? 'Según fecha del periodo'}</td><td>{hours(row.known)}</td>{reserve && <td>{hours(row.known + row.reserve)}</td>}<td>{hours(row.capacity)}</td>{reinforcement && <td>{hours(row.reinforcement ?? 0)}</td>}</tr>)}</tbody></table></div></details></>;
}
