import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronRight, X } from 'lucide-react';
import { clock, hours, type ForecastDataset, type ForecastModel, type ForecastScreen, type ForecastTask } from './forecastContract';
import { centerKind, centerLabel, countLabel, duration, fullDate, groupIssues, normalize, personName, sourceLabel, taskConflicts } from './forecastPresentation';

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
  const state = tone ?? (/verificar|resolver|pendiente|incompatible|parcial/i.test(value) ? 'amber' : /propuest|simulad/i.test(value) ? 'proposal' : /verificadas|alcanzable/i.test(value) ? 'green' : 'neutral');
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
export function Issues({ dataset, model, to, compact = false }: Pick<ScreenProps, 'dataset' | 'model' | 'to'> & { compact?: boolean }) {
  const groups = groupIssues(model.issues);
  return <div className="sf-issues">{!groups.length && <Empty>No hay incidencias registradas en el contexto consultado.</Empty>}{groups.map(group => <details className="sf-issue-group" key={group.code}><summary><strong>{group.title}</strong><Badge>{countLabel(group.issues.length, 'aviso')}</Badge></summary><p>{group.impact}</p><ul>{group.issues.map((issue, index) => {
    const workers = dataset.workers.filter(w => issue.workerId === w.id || issue.ids.includes(w.id));
    const tasks = dataset.tasks.filter(t => issue.ids.includes(t.id));
    const centers = dataset.centers.filter(c => issue.centerId === c.id || issue.ids.includes(c.id));
    return <li key={index}><p>{issue.message}</p>{issue.date && <small>{fullDate(issue.date)}</small>}<div className="sf-inline-links">{workers.map(w => <Link key={w.id} to={to('team', { person: w.id })}>Revisar {personName(w.name)}</Link>)}{tasks.map(t => <Link key={t.id} to={to('shifts', { task: t.id, date: t.date, focusMonth: t.date.slice(0, 7), view: 'day' })}>Revisar {t.name}</Link>)}{centers.map(c => <Link key={c.id} to={to('centers', { detail: c.id })}>Revisar {centerLabel(c)}</Link>)}</div>{!workers.length && !tasks.length && !centers.length && <p>La administración de la sede debe revisar {sourceLabel(issue.source).toLowerCase()}. {issue.code === 'source-unavailable' ? 'Vuelve a actualizar los datos.' : 'Usa la referencia de soporte si no puedes identificar el registro.'}</p>}<details><summary>Referencia para soporte</summary><code>{issue.code} · {issue.source} · {issue.ids.join(', ') || 'Toda la consulta'}</code><button onClick={() => navigator.clipboard?.writeText(`${issue.message}\n${issue.source}: ${issue.ids.join(', ')}`).catch(() => {})}>Copiar referencia</button></details></li>;
  })}</ul></details>)}{compact && groups.length > 0 && <Link className="sf-button" to={to('settings', { tab: 'data' })}>Abrir datos por revisar</Link>}</div>;
}
export function TaskList({ tasks, dataset, model, to, screen, reset }: Pick<ScreenProps, 'dataset' | 'model' | 'to' | 'screen'> & { tasks: ForecastTask[]; reset?: () => void }) {
  const [limit, setLimit] = useState(25);
  if (!tasks.length) return <Empty reset={reset}>{reset ? 'No hay resultados con estos filtros.' : 'No hay tareas registradas en este periodo.'}</Empty>;
  return <div className="sf-task-list">{tasks.slice(0, limit).map(t => {
    const proposal = model.placements.find(p => p.taskId === t.id && !p.real);
    const conflicts = taskConflicts(t, model);
    const owner = dataset.workers.find(w => w.id === t.workerId);
    const link = { task: t.id, person: '', detail: '', focusMonth: t.date.slice(0, 7) };
    return <article className="sf-task-card" key={t.id}><div><Link className="sf-task-name" to={to(screen, link)}>{t.name}</Link><small>{fullDate(t.date)} · {dataset.centers.find(c => c.id === t.centerId)?.name}</small><span>Duración: {duration(t.minutes)} · Ventana: {clock(t.windowStart)}–{clock(t.windowEnd)}</span></div><div><Badge>{t.ambiguous ? 'Asignación por verificar' : owner ? 'Asignada' : t.workerId ? 'Persona por verificar' : 'Sin asignar'}</Badge>{owner && <p>{personName(owner.name)}</p>}<small>Horario registrado: {clock(t.start)}–{clock(t.end)}{!t.workerId && ' · sin responsable'}</small>{conflicts.length > 0 && <Badge>{conflicts[0]}</Badge>}</div>{proposal && <div className="sf-proposal"><Badge>Propuesta · sin guardar</Badge><p>{personName(model.workers.find(w => w.id === proposal.workerId)?.name ?? 'Persona por verificar')}</p><span>{clock(proposal.start)}–{clock(proposal.end)}</span>{t.workerId && <small>Recomendación de cambio de la asignación existente.</small>}</div>}<div className="sf-inline-links"><Link to={to(screen, link)}>Ver tarea</Link>{!t.workerId && !t.ambiguous && <Link to={to(screen, { ...link, detail: 'candidates' })}>Ver candidatos</Link>}</div></article>;
  })}{tasks.length > limit && <button onClick={() => setLimit(limit + 25)}>Mostrar más · {tasks.length - limit} restantes</button>}</div>;
}
export interface ChartRow { key: string; label: string; known: number; capacity: number; reserve: number; phase?: string }
export function ForecastChart({ rows, reserve }: { rows: ChartRow[]; reserve: boolean }) {
  const maximum = Math.max(60, ...rows.flatMap(r => [r.known, r.capacity, r.known + (reserve ? r.reserve : 0)].filter(Number.isFinite)));
  const width = 800, bottom = 212, left = 65, step = 710 / Math.max(1, rows.length);
  const x = (i: number) => left + step * (i + .5), y = (value: number) => bottom - value / maximum * 172;
  const [selected, setSelected] = useState<string>('');
  const active = rows.find(r => r.key === selected);
  const series = [{ value: (r: ChartRow) => r.known, color: '#168486', name: 'Trabajo conocido' }, { value: (r: ChartRow) => r.capacity, color: '#285d94', name: 'Capacidad de referencia' }, ...(reserve ? [{ value: (r: ChartRow) => r.known + r.reserve, color: '#795719', name: 'Con reserva +20 %' }] : [])];
  return <><div className="sf-chart-scroll"><svg className="sf-chart" viewBox={`0 0 ${width} 258`} role="img" aria-label="Evolución en horas; los valores desconocidos quedan sin trazar. Tabla de datos disponible debajo.">{rows.map((row, i) => row.phase === 'Futuro' && <rect key={`phase-${row.key}`} x={left + step * i} y="32" width={step} height={180} fill="#edf4f8"><title>{row.label} · Futuro</title></rect>)}{[0, 1, 2, 3, 4].map(n => <g key={n}><line x1={left} x2="785" y1={y(maximum * n / 4)} y2={y(maximum * n / 4)} stroke="#d5e1e8" /><text x="55" y={y(maximum * n / 4) + 5} textAnchor="end">{Math.round(maximum * n / 240)} h</text></g>)}{series.map((s, seriesIndex) => <g key={s.name}>{rows.map((row, i) => Number.isFinite(s.value(row)) && <g key={row.key}>{i > 0 && Number.isFinite(s.value(rows[i - 1])) && <line x1={x(i - 1)} y1={y(s.value(rows[i - 1]))} x2={x(i)} y2={y(s.value(row))} stroke={s.color} strokeWidth="3" strokeDasharray={seriesIndex === 2 ? '6 5' : undefined} />}<circle tabIndex={0} role="button" aria-label={`${row.label}, ${s.name}: ${hours(s.value(row))}`} onFocus={() => setSelected(row.key)} onClick={() => setSelected(row.key)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(row.key); } }} cx={x(i)} cy={y(s.value(row))} r="5" fill={s.color}><title>{row.label}: {hours(s.value(row))}</title></circle></g>)}</g>)}{rows.map((row, i) => i % Math.max(1, Math.ceil(rows.length / 8)) === 0 && <text key={row.key} x={x(i)} y="245" textAnchor="middle">{row.key}</text>)}</svg></div><div className="sf-legend">{series.map(s => <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>)}</div>{rows.some(r => r.phase) && <p className="sf-caption">Fondo azul claro: fechas futuras. La tabla distingue pasado, periodo en curso y futuro; las horas pasadas no implican ejecución confirmada.</p>}{active && <p className="sf-caption" role="status">{active.label}: trabajo {hours(active.known)} · capacidad {hours(active.capacity)}{reserve && ` · con reserva ${hours(active.known + active.reserve)}`}</p>}{rows.some(r => !Number.isFinite(r.known)) && <p className="sf-caption">Hay duraciones pendientes: los puntos desconocidos no se convierten en cero.</p>}<details className="sf-chart-data"><summary>Consultar tabla de datos del gráfico</summary><div className="sf-table-scroll"><table><caption>Valores en horas del mismo periodo que el gráfico</caption><thead><tr><th>Periodo</th><th>Momento</th><th>Trabajo conocido</th>{reserve && <th>Con reserva</th>}<th>Capacidad de referencia</th></tr></thead><tbody>{rows.map(row => <tr key={row.key}><th>{row.label}</th><td>{row.phase ?? 'Según fecha del periodo'}</td><td>{hours(row.known)}</td>{reserve && <td>{hours(row.known + row.reserve)}</td>}<td>{hours(row.capacity)}</td></tr>)}</tbody></table></div></details></>;
}
