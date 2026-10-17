// Backend simulado SOLO para la prueba de navegador de la recuperación de borradores.
// Sustituye los hooks de datos del planificador; la página, el panel y los avisos son los reales.
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { buildPlanningExample, type PlanningExampleScenario } from './cleaningPlanningExampleData';
import { buildCleaningPlanningModel } from '../src/utils/cleaningPlanning';
import { buildCapacityMapFromAvailability } from '../src/utils/cleaning-planning/availability';
import { validateProposalBatchForApply } from '../src/utils/cleaning-planning/proposalBatchApply';
import { formatMadridDate } from '../src/utils/date';

declare global {
  interface Window {
    planningScenario?: PlanningExampleScenario;
    planningApplyCalls?: number;
    planningQuickWrites?: number;
    planningFailNextSave?: boolean;
    planningSavedProposals?: unknown[];
    fixtureBackend?: typeof fixtureBackend;
  }
}

const OVERRIDES_KEY = 'fixture:overrides';
const SEDE_KEY = 'fixture:sede';
const params = new URLSearchParams(window.location.search);
const sedes = [{ id: 'sede-1', nombre: 'Sede Uno' }, { id: 'sede-2', nombre: 'Sede Dos' }];

type Overrides = { tasks: Record<string, Record<string, unknown>>; availability: Record<string, Record<string, unknown>>; cleaners: Record<string, Record<string, unknown>> };
const readOverrides = (): Overrides => {
  try { return { tasks: {}, availability: {}, cleaners: {}, ...JSON.parse(sessionStorage.getItem(OVERRIDES_KEY) || '{}') }; } catch { return { tasks: {}, availability: {}, cleaners: {} }; }
};

let version = 0;
let listeners: Array<() => void> = [];
const notify = () => { version += 1; listeners.forEach((listener) => listener()); };
const subscribe = (listener: () => void) => { listeners = [...listeners, listener]; return () => { listeners = listeners.filter((item) => item !== listener); }; };
const names: Record<string, string> = {};

const applyPatch = (task: any, patch: Record<string, any> | undefined) => {
  if (!patch) return task;
  const next = { ...task, ...patch };
  if (patch.cleanerIds) {
    next.cleanerId = patch.cleanerIds[0];
    next.cleaner = patch.cleanerIds[0] ? names[patch.cleanerIds[0]] : undefined;
    next.assignments = patch.cleanerIds.map((cleaner_id: string) => ({ cleaner_id }));
  }
  if (patch.startTime) next.displayStartTime = patch.startTime;
  if (patch.endTime) next.displayEndTime = patch.endTime;
  return next;
};

const exampleFor = (day: string) => {
  const example = buildPlanningExample(window.planningScenario || 'normal', day);
  example.cleaners.forEach((cleaner) => { names[cleaner.id] = cleaner.name; });
  return example;
};

export const fixtureBackend = {
  patchTask(id: string, patch: Record<string, unknown>) {
    const overrides = readOverrides();
    overrides.tasks[id] = { ...overrides.tasks[id], ...patch };
    sessionStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
    notify();
  },
  patchAvailability(cleanerId: string, patch: Record<string, unknown>) {
    const overrides = readOverrides();
    overrides.availability[cleanerId] = { ...overrides.availability[cleanerId], ...patch };
    sessionStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
    notify();
  },
  patchCleaner(id: string, patch: Record<string, unknown>) {
    const overrides = readOverrides();
    overrides.cleaners[id] = { ...overrides.cleaners[id], ...patch };
    sessionStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
    notify();
  },
  rawTasks(day: string) {
    const overrides = readOverrides();
    return exampleFor(day).tasks.map((task) => applyPatch(task, overrides.tasks[task.id]));
  },
  subscribe,
  getVersion: () => version,
};
window.fixtureBackend = fixtureBackend;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const useCleaningPlanning = ({ date }: { date: Date; preset: string }) => {
  const current = useSyncExternalStore(subscribe, fixtureBackend.getVersion);
  const day = formatMadridDate(date);
  const range = useMemo(() => ({ startDate: day, endDate: day }), [day]);
  const model = useMemo(() => {
    const example = exampleFor(day);
    const overrides = readOverrides();
    const cleaners = example.cleaners.map((cleaner) => ({ ...cleaner, ...(overrides.cleaners[cleaner.id] as object) }));
    const effectiveAvailability = example.effectiveAvailability.map((item) => ({ ...item, ...(overrides.availability[item.cleanerId] as object) }));
    const tasks = fixtureBackend.rawTasks(day);
    const planning = buildCleaningPlanningModel(tasks as never, cleaners as never, buildCapacityMapFromAvailability(effectiveAvailability as never), day, day);
    return { planning, effectiveAvailability, cleaners };
  }, [day, current]);
  const refetch = useCallback(async () => ({ isError: false, data: fixtureBackend.rawTasks(day) as never[] }), [day]);
  return { planning: model.planning, range, effectiveAvailability: model.effectiveAvailability, isLoading: false, isError: false, error: null, refetch };
};

export const useCleaners = () => {
  const current = useSyncExternalStore(subscribe, fixtureBackend.getVersion);
  const cleaners = useMemo(() => {
    const overrides = readOverrides();
    return buildPlanningExample(window.planningScenario || 'normal', '2026-01-01').cleaners.map((cleaner) => ({ ...cleaner, ...(overrides.cleaners[cleaner.id] as object) }));
  }, [current]);
  const refetch = useCallback(async () => undefined, []);
  return { cleaners, refetch, isLoading: false };
};

const buildingData = {
  propertyGroups: [{ id: 'example-building', name: 'EDIFICIO', isActive: true }],
  propertyAssignments: [],
  cleanerAssignments: buildPlanningExample(window.planningScenario || 'normal', '2026-01-01').activeCleanerAssignments,
  excludedCleanerAssignments: [],
};
const buildingQuery = { data: buildingData, isLoading: false, isError: false, refetch: async () => undefined };
export const useCleaningPlanningBuildingData = () => buildingQuery;

export const extractBuildingCode = () => 'EDIFICIO';

const authValue = { user: { id: params.get('user') || 'user-1' } };
export const useAuth = () => authValue;

export const useSede = () => {
  const [id, setId] = useState(() => params.get('sede') || sessionStorage.getItem(SEDE_KEY) || 'sede-1');
  const activeSede = sedes.find((sede) => sede.id === id) || sedes[0];
  return {
    activeSede, availableSedes: sedes,
    setActiveSede: (sede: { id: string }) => { sessionStorage.setItem(SEDE_KEY, sede.id); setId(sede.id); },
  };
};

export const useCleaningPlanningActions = () => {
  const [pending, setPending] = useState(false);
  const quick = (patch: Record<string, unknown>, id: string) => {
    window.planningQuickWrites = (window.planningQuickWrites || 0) + 1;
    fixtureBackend.patchTask(id, patch);
  };
  const applyProposal = async (input: Parameters<typeof validateProposalBatchForApply>[0]) => {
    window.planningApplyCalls = (window.planningApplyCalls || 0) + 1;
    setPending(true);
    try {
      await sleep(80);
      if (window.planningFailNextSave) { window.planningFailNextSave = false; throw new Error('Fallo local simulado'); }
      const validation = validateProposalBatchForApply(input);
      if (!validation.canApply) throw new Error(validation.items.find((item) => item.status === 'blocked')?.message || 'La propuesta ya no es aplicable.');
      validation.taskPlans.forEach((plan) => fixtureBackend.patchTask(plan.taskId, { cleanerIds: plan.cleanerIds, startTime: plan.proposedStartTime, endTime: plan.proposedEndTime }));
      window.planningSavedProposals = input.proposals;
      return { validation, results: [] };
    } finally {
      setPending(false);
    }
  };
  return {
    applyProposal, isApplyingProposal: pending, isSavingQuickAction: false,
    unassignTaskAsync: async (task: { id: string }) => quick({ cleanerIds: [] }, task.id),
    updateTaskSchedule: async ({ task, startTime, endTime }: { task: { id: string }; startTime: string; endTime: string }) => quick({ startTime, endTime }, task.id),
    reassignTask: async ({ task, cleaner, startTime, endTime }: { task: { id: string }; cleaner: { id: string }; startTime?: string; endTime?: string }) => quick({ cleanerIds: [cleaner.id], ...(startTime ? { startTime, endTime } : {}) }, task.id),
  };
};

export const usePlanningCalendarWeek = () => ({ data: [], startDate: '2026-09-21', endDate: '2026-09-27', isPending: false, isError: false });
export const useSidebar = () => ({ state: 'expanded', isMobile: window.matchMedia('(max-width: 767px)').matches });
