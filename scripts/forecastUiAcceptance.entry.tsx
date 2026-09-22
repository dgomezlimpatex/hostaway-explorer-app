// Isolated test harness. Never imported by the application or its routes.
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useParams, useSearchParams, Routes, Route } from 'react-router-dom';
import { ForecastWorkspaceView } from '../src/features/staffing/ForecastWorkspaceView';
import { parseForecastContext, type ForecastScreen } from '../src/features/staffing/forecastContract';
import { context, task, visualFixture, worker } from './forecastFixture';
const fixture = visualFixture();
const initialFixture = new URLSearchParams(window.location.search).get('fixture');
fixture.from = '2026-08-31'; fixture.to = '2026-12-06';
fixture.centers.push({ id: 'empty-center', name: 'Centro sin tareas de prueba', startMinute: 660, endMinute: 1020, propertyCount: 0 });
fixture.workers.push(worker('excluded', { name: 'PERSONA EXCLUIDA', excluded: true }), worker('unknown', { name: 'JORNADA POR REVISAR', contractKnown: false }));
fixture.workers[0].blockedSlots = [{ day: 2, startMinute: 480, endMinute: 540, consumesContract: true }];
fixture.issues.push({ code: 'unknown-contract', source: 'cleaners', ids: ['unknown'], impact: 'ledger', message: 'Jornada de ficha desconocida.' });
fixture.tasks.push(task('window-conflict', { name: 'Ventana contradictoria', centerId: 'c0', date: '2026-10-19', minutes: 33, start: 600, end: 633 }));
fixture.tasks.push(task('november', { name: 'Tarea de noviembre', centerId: 'c0', date: '2026-11-02', minutes: 60 }));
function App() {
  const [params] = useSearchParams();
  const { screen = 'forecast' } = useParams();
  const current = parseForecastContext(params, context.sedeId, '2026-10-05T09:00');
  const kind = params.get('fixture') ?? initialFixture;
  const visible = kind === 'no-fit' ? { ...fixture, workers: [], tasks: [task('impossible', { date: '2026-10-19', centerId: 'c0', minutes: 400 })], issues: [] }
    : kind === 'sequence' ? { ...fixture, workers: [], tasks: [task('later', { name: 'Servicio tercero', date: '2026-10-19', centerId: 'c0', windowStart: 840, windowEnd: 900 }), task('early', { name: 'Servicio primero', date: '2026-10-19', centerId: 'c0', windowStart: 660, windowEnd: 720 }), task('middle', { name: 'Servicio segundo', date: '2026-10-19', centerId: 'c0', windowStart: 720, windowEnd: 780 })], issues: [] }
    : kind === 'other-services' ? { ...fixture, tasks: [task('imported-service', { name: 'Turno importado de prueba', date: '2026-10-06', centerId: 'c0', workerId: 'w0', tourism: false, start: 660, end: 720 })], workers: fixture.workers.map(w => ({ ...w, blockedSlots: [] })), issues: [] }
    : kind === 'empty' ? { ...fixture, tasks: [], workers: [], centers: [], issues: [] } : kind === 'partial' ? { ...fixture, tasks: fixture.tasks.map((t, i) => i === 0 ? { ...t, minutes: NaN } : t), issues: [...fixture.issues, { code: 'missing-duration', source: 'properties', ids: [fixture.tasks[0].id], impact: 'demand' as const, message: 'Duración desconocida.' }] } : fixture;
  return <ForecastWorkspaceView screen={screen as ForecastScreen} context={current} dataset={kind === 'error' || kind === 'loading' ? undefined : visible} sedeName="Sede sintética de pruebas" loading={kind === 'loading'} error={kind === 'error' ? 'Consulta cancelada.' : undefined} refresh={() => { window.location.search = window.location.search.replace('fixture=error', 'fixture=ready'); }} cancel={() => { window.location.search = window.location.search.replace('fixture=loading', 'fixture=error'); }} />;
}
createRoot(document.getElementById('root')!).render(<BrowserRouter><Routes><Route path="/staffing-forecast/screens/:screen" element={<App />} /><Route path="*" element={<App />} /></Routes></BrowserRouter>);
