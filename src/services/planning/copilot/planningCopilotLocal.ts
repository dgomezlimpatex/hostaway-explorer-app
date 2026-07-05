import type { PlanningCopilotReply, PlanningCopilotSnapshot } from '@/types/planningCopilot';
import { proposalsToCopilotActions } from '@/types/planningCopilot';
import { describePlanningScope } from './planningSnapshot';

const normalize = (value: string): string => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const proposalSummary = (snapshot: PlanningCopilotSnapshot): string => {
  const proposal = snapshot.activeProposal;
  if (!proposal) {
    return 'Todavía no hay una propuesta activa. Puedo generar una para los filtros visibles.';
  }

  const largeHouseAssignments = proposal.proposals.filter((item) => (item.requiredCleaners || 1) > 1).length;
  return [
    `Propuesta activa: ${proposal.proposals.length} asignaciones y ${proposal.conflicts.length} conflictos.`,
    largeHouseAssignments > 0 ? `${largeHouseAssignments} asignaciones pertenecen a casas grandes/multi-persona.` : null,
    'Todas las acciones requieren tu confirmación antes de guardarse; al confirmar, se notifica inmediatamente.',
  ].filter(Boolean).join(' ');
};

const conflictSummary = (snapshot: PlanningCopilotSnapshot): string => {
  const proposalConflicts = snapshot.activeProposal?.conflicts || [];
  if (proposalConflicts.length === 0 && snapshot.summary.conflictTasks === 0) {
    return 'No veo conflictos destacados en el subconjunto visible. Si quieres, puedo generar o recalcular una propuesta para confirmarlo.';
  }

  const conflictLines = proposalConflicts.slice(0, 5).map((conflict) => `• ${conflict.message}`).join('\n');
  return `Hay ${snapshot.summary.conflictTasks} tareas con riesgo visible y ${proposalConflicts.length} conflictos en la propuesta activa.${conflictLines ? `\n${conflictLines}` : ''}`;
};

export const buildPlanningCopilotReply = (
  message: string,
  snapshot: PlanningCopilotSnapshot,
): PlanningCopilotReply => {
  const text = normalize(message);
  const scope = describePlanningScope(snapshot);

  if (text.includes('aplica') || text.includes('guardar') || text.includes('confirma')) {
    return {
      message: snapshot.activeProposal?.proposals.length
        ? `Puedo ayudarte a aplicar la propuesta, pero por seguridad debes pulsar “Revisar y confirmar” en el panel. Alcance actual: ${scope}.`
        : `No hay propuesta aplicable todavía. Primero genera una propuesta para: ${scope}.`,
      actions: snapshot.activeProposal ? proposalsToCopilotActions(snapshot.activeProposal.proposals) : [],
      shouldOpenConfirmation: Boolean(snapshot.activeProposal?.proposals.length),
    };
  }

  if (text.includes('conflicto') || text.includes('riesgo') || text.includes('revision')) {
    return {
      message: `${conflictSummary(snapshot)}\n\nAlcance: ${scope}.`,
      actions: snapshot.activeProposal ? proposalsToCopilotActions(snapshot.activeProposal.proposals) : [],
    };
  }

  if (text.includes('planifica') || text.includes('propuesta') || text.includes('asigna') || text.includes('recalcula')) {
    return {
      message: `Voy a preparar una propuesta para el subconjunto visible: ${scope}. Priorizaré check-in temprano a las 14:00, titular → suplentes → backups, casas grandes >6h con 3 personas y buffer de 10 min en mismo edificio.`,
      actions: [],
      shouldGenerateProposal: true,
    };
  }

  if (text.includes('resumen') || text.includes('estado')) {
    return {
      message: [
        `Resumen del alcance actual: ${scope}.`,
        `${snapshot.summary.unassignedTasks} sin asignar, ${snapshot.summary.assignedTasks} asignadas, ${snapshot.summary.earlyCheckInTasks} early check-in y ${snapshot.summary.largeHouseTasks} casas grandes.`,
        proposalSummary(snapshot),
      ].join(' '),
      actions: snapshot.activeProposal ? proposalsToCopilotActions(snapshot.activeProposal.proposals) : [],
    };
  }

  return {
    message: [
      `Estoy trabajando sobre: ${scope}.`,
      'Puedes pedirme: “planifica”, “explica conflictos”, “resumen” o “aplica”.',
      'Por seguridad, yo preparo borradores y tú confirmas antes de guardar/notificar.',
    ].join(' '),
    actions: snapshot.activeProposal ? proposalsToCopilotActions(snapshot.activeProposal.proposals) : [],
  };
};
