import { usePlanningSavedTaskContext } from '../src/hooks/usePlanningSavedTaskContext';
import { buildProposalContextKey } from '../src/utils/cleaning-planning/proposalContext';
import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { AssignmentProposalPanel } from '../src/components/cleaning-planning/AssignmentProposalPanel';
import { PlanningStartScreen } from '../src/components/cleaning-planning/PlanningStartScreen';
import { PlanningDayNavigation } from '../src/components/cleaning-planning/PlanningDayNavigation';
import { buildPlanningExample, type PlanningExampleScenario } from './cleaningPlanningExampleData';
import type { AssignmentProposal } from '../src/types/cleaningPlanning';
import { formatMadridDate } from '../src/utils/date';
import type { Sede } from '../src/types/sede';

declare global {
  interface Window {
    planningExampleScenario?: PlanningExampleScenario;
    planningExampleControls?: boolean;
    planningExampleSaved?: { count: number; proposals: AssignmentProposal[] };
  }
}

function Fixture() {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date('2026-09-26T12:00:00'));
  const [scenario, setScenario] = useState<PlanningExampleScenario>(window.planningExampleScenario || 'normal');
  const [savedTaskIds, setSavedTaskIds] = useState<string[]>([]);
  const day = formatMadridDate(date);
  const base = useMemo(() => buildPlanningExample(scenario, day), [scenario, day]);
  const [tasks, setTasks] = useState(base.tasks);
  useEffect(() => setTasks(base.tasks), [base]);
  useEffect(() => {
    const saved = (event: Event) => {
      const {taskId, unassign, cleaner, startTime, endTime} = (event as CustomEvent).detail;
      setTasks(current => current.map(task => task.id !== taskId ? task : {
        ...task, ...(unassign ? {cleanerId:undefined, cleaner:undefined, assignments:[]} : {}),
        ...(cleaner ? {cleanerId:cleaner.id, cleaner:cleaner.name, assignments:[{cleaner_id:cleaner.id}]} : {}),
        ...(startTime ? {startTime, displayStartTime:startTime, endTime, displayEndTime:endTime} : {}),
      }));
    };
    window.addEventListener('planning-example-task-saved', saved);
    return () => window.removeEventListener('planning-example-task-saved', saved);
  }, []);
  const example = {...base, tasks};
  const context = buildProposalContextKey({activeSedeId:'demo',cleanerIds:base.cleaners.map(c=>c.id),
    availability:base.effectiveAvailability,filters:{},range:{startDate:day,endDate:day},tasks} as Parameters<typeof buildProposalContextKey>[0]);
  const [sourceContext, setSourceContext] = useState(context);
  const recordSavedTask = usePlanningSavedTaskContext(sourceContext, context, setSourceContext);
  const showProposal = () => {
    const update = () => flushSync(() => {setSourceContext(context);setOpen(true);});
    if (typeof document.startViewTransition === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      void document.startViewTransition(update);
    } else update();
  };
  const saveExample = async (proposals: AssignmentProposal[]) => {
    window.planningExampleSaved = { count: (window.planningExampleSaved?.count || 0) + 1, proposals };
    await new Promise(resolve => setTimeout(resolve, 100));
    setSavedTaskIds(proposals.map(proposal => proposal.taskId));
  };
  const changeScenario = (nextScenario: PlanningExampleScenario) => {
    // This origin only contains the isolated demo. Different datasets must not
    // restore assignments from the preceding scenario, whose IDs are reused.
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith('cleaning-planning:hermes-draft:')) sessionStorage.removeItem(key);
    }
    setScenario(nextScenario); setOpen(false); setSavedTaskIds([]);
    window.planningExampleSaved = undefined;
  };
  return <div className="min-h-screen bg-paper p-3 md:p-8">
    {window.planningExampleControls && <aside className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-4 text-sm">
      <div><p className="font-semibold text-ink">Ejemplo local del planificador</p><p className="mt-1 text-ink-3">Los datos son ficticios. Guardar solo actualiza este ejemplo.</p></div>
      <select aria-label="Escenario de ejemplo" className="min-h-11 rounded-lg border border-line bg-white px-3 text-ink" value={scenario} onChange={event => changeScenario(event.target.value as PlanningExampleScenario)}>
        <option value="normal">Jornada sencilla</option><option value="availability">Disponibilidad y bloqueos</option><option value="shared">Limpieza con dos trabajadoras</option><option value="load">Día con 150 tareas</option>
      </select>
    </aside>}
    {open ? <>
      <PlanningDayNavigation date={date} onChange={setDate} />
      <AssignmentProposalPanel
        selectedDay={day} proposal={example.proposal} tasks={base.tasks.filter(task => !task.cleanerId)} calendarTasks={example.tasks}
        cleaners={example.cleaners} effectiveAvailability={example.effectiveAvailability} activeCleanerAssignments={example.activeCleanerAssignments}
        isStale={sourceContext !== context} onTaskSaved={recordSavedTask}
        sedeName="Centro" onClear={() => setOpen(false)} onApply={saveExample} savedTaskIds={savedTaskIds}
      />
    </> : <PlanningStartScreen date={date} activeSede={{ id: 'demo', nombre: 'Centro' } as Sede} availableSedes={[]}
        pendingTaskCount={example.tasks.filter(task => !task.cleanerId).length} totalPendingTaskCount={example.tasks.filter(task => !task.cleanerId).length} scopeLabel="Día completo" isLoading={false} isError={false}
        buildingDataError={false} canGenerateProposal onDateChange={setDate} onSedeChange={() => {}}
        onGenerateProposal={showProposal} onRetry={() => {}} advancedContent={<p>Filtros de prueba</p>} />}
  </div>;
}

createRoot(document.getElementById('root')!).render(<Fixture />);
export { Fixture };
