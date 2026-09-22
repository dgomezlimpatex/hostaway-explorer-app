// Isolated test harness. Never imported by the application or its routes.
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useParams, useSearchParams, Routes, Route } from 'react-router-dom';
import { ForecastWorkspaceView } from '../src/features/staffing/ForecastWorkspaceView';
import { parseForecastContext, type ForecastScreen } from '../src/features/staffing/forecastContract';
import { context, task, visualFixture, worker } from './forecastFixture';
const fixture = visualFixture();
fixture.from = '2026-08-31'; fixture.to = '2026-12-06';
fixture.workers.push(worker('excluded', { name: 'PERSONA EXCLUIDA', excluded: true }), worker('unknown', { name: 'JORNADA POR REVISAR', contractKnown: false }));
fixture.workers[0].blockedSlots = [{ day: 2, startMinute: 480, endMinute: 540, consumesContract: true }];
fixture.issues.push({ code: 'unknown-contract', source: 'cleaners', ids: ['unknown'], impact: 'ledger', message: 'Jornada de ficha desconocida.' });
fixture.tasks.push(task('window-conflict', { name: 'Ventana contradictoria', centerId: 'c0', date: '2026-10-19', minutes: 33, start: 600, end: 633 }));
fixture.tasks.push(task('november', { name: 'Tarea de noviembre', centerId: 'c0', date: '2026-11-02', minutes: 60 }));
function App() {
  const [params] = useSearchParams();
  const { screen = 'forecast' } = useParams();
  const current = parseForecastContext(params, context.sedeId, '2026-10-05T09:00');
  const kind = params.get('fixture');
  const visible = kind === 'empty' ? { ...fixture, tasks: [], workers: [], centers: [], issues: [] } : kind === 'partial' ? { ...fixture, tasks: fixture.tasks.map((t, i) => i === 0 ? { ...t, minutes: NaN } : t), issues: [...fixture.issues, { code: 'missing-duration', source: 'properties', ids: [fixture.tasks[0].id], impact: 'demand' as const, message: 'Duración desconocida.' }] } : fixture;
  return <ForecastWorkspaceView screen={screen as ForecastScreen} context={current} dataset={kind === 'error' || kind === 'loading' ? undefined : visible} sedeName="Sede sintética de pruebas" loading={kind === 'loading'} error={kind === 'error' ? 'Consulta cancelada.' : undefined} refresh={() => { window.location.search = window.location.search.replace('fixture=error', 'fixture=ready'); }} cancel={() => { window.location.search = window.location.search.replace('fixture=loading', 'fixture=error'); }} />;
}
createRoot(document.getElementById('root')!).render(<BrowserRouter><Routes><Route path="/staffing-forecast/screens/:screen" element={<App />} /><Route path="*" element={<App />} /></Routes></BrowserRouter>);
