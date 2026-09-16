import { createRoot } from 'react-dom/client';
import { StaffingDashboard } from '../src/features/staffing/StaffingDashboard';
import { buildStaffingForecast } from '../src/features/staffing/engine';
import type { StaffingDataset } from '../src/features/staffing/types';

// Deliberately synthetic fixture. Never imported by the production app or its data reader.
const dateFrom = '2026-09-14';
const dateAt = (offset: number) => new Date(Date.parse(`${dateFrom}T12:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
const dataset: StaffingDataset = {
  fetchedAt: '2026-09-14T12:00:00Z', issues: [], inventory: [],
  centers: [
    { id: 'dormant', name: 'Centro sin actividad · demo', startMinute: 660, endMinute: 1020 },
    { id: 'north', name: 'Centro Norte · demo', startMinute: 660, endMinute: 1020 },
    { id: 'south', name: 'Centro Sur · demo', startMinute: 720, endMinute: 960 },
    { id: 'hotel', name: 'Hotel · demo', startMinute: 660, endMinute: 960 },
  ],
  workers: Array.from({ length: 8 }, (_, i) => ({ id: `w${i}`, name: `Operario demo ${i + 1}`, weeklyMinutes: i < 4 ? 1200 : 900,
    engagement: i === 7 ? 'collaborator' as const : 'employee' as const,
    homeCenterIds: [i < 3 ? 'north' : i < 6 ? 'south' : 'hotel'], availability: Array.from({ length: 7 }, (_, day) => ({ day, startMinute: 660, endMinute: 1020 })),
    restDay: i % 7, flexibleRest: i === 7, canMove: true, unavailableDates: [], confirmedRestDates: [], costPerHour: 17,
  })),
  services: Array.from({ length: 84 }, (_, offset) => {
    const weekend = offset % 7 >= 5;
    const count = offset < 28 ? (weekend ? 10 : 7) : (weekend ? 6 : 3);
    return Array.from({ length: count }, (_, i) => {
      const centerId = i % 3 === 0 ? 'north' : i % 3 === 1 ? 'south' : 'hotel';
      return { id: `demo-${offset}-${i}`, date: dateAt(offset), centerId, personMinutes: centerId === 'hotel' ? 75 : 120, startMinute: centerId === 'south' ? 720 : 660, endMinute: centerId === 'north' ? 1020 : 960, requiredWorkers: 1, source: 'reservation' as const, kind: centerId === 'hotel' ? 'stay' as const : 'checkout' as const };
    });
  }).flat(),
};
const stress = document.documentElement.dataset.staffingStress === 'true';
const stressDataset: StaffingDataset = {
  ...dataset, centers: [dataset.centers[1]],
  workers: Array.from({ length: 20 }, (_, i) => ({ ...dataset.workers[0], id: `w${i}`, name: `Operario demo ${i + 1}`, weeklyMinutes: 2400, restDay: i % 7 })),
  services: Array.from({ length: 2016 }, (_, i) => ({ ...dataset.services[0], id: `stress-${i}`, date: dateAt(Math.floor(i / 12)), centerId: 'north', personMinutes: 60 })),
};
const measuredCompute: typeof buildStaffingForecast = (...args) => {
  const start = performance.now();
  const computed = buildStaffingForecast(...args);
  const result = mode === 'duplicate' && computed.days.length ? { ...computed, days: [computed.days[0], { ...computed.days[0] }] } : computed;
  const element = document.documentElement;
  element.dataset.maxComputeMs = String(Math.max(Number(element.dataset.maxComputeMs || 0), performance.now() - start));
  element.dataset.computeCount = String(Number(element.dataset.computeCount || 0) + 1);
  element.dataset.computeIncomplete = String(result.issues.some(issue => issue.code === 'workload-limit'));
  return result;
};
const mode = document.documentElement.dataset.staffingMode;
const short = mode === 'short';
const manyCenters = Array.from({ length: 40 }, (_, i) => ({ ...dataset.centers[1], id: `center-${i}`, name: `Centro de prueba ${String(i).padStart(2, '0')} · nombre largo` }));
const manyDataset = { ...dataset, centers: manyCenters, services: manyCenters.flatMap((center, i) => Array.from({ length: 7 }, (_, day) => ({ ...dataset.services[0], id: `${center.id}-${day}`, centerId: center.id, date: dateAt(day), personMinutes: (i + 1) * 15 }))) };
const shown = mode === 'many' ? manyDataset : mode === 'duplicate' ? { ...dataset, services: [dataset.services[0], dataset.services[0]] } : mode === 'empty' ? { ...dataset, services: [], workers: [] } : mode === 'error' ? { ...dataset, issues: [{ code: 'source-unavailable', message: 'Fuente sintética no disponible' }] } : dataset;
createRoot(document.getElementById('root')!).render(<><div className="bg-amber-200 p-4 text-center text-sm font-bold text-amber-950" role="note">DEMOSTRACIÓN CON DATOS SINTÉTICOS · No son reservas, trabajadores ni previsiones de Limpatex · Sin conexión a producción</div><StaffingDashboard demo sedeName="Sede sintética" dataset={stress ? stressDataset : shown} dateFrom={dateFrom} asOf={dateFrom} weeks={stress ? 24 : short ? 4 : 12} compute={measuredCompute} /></>);
