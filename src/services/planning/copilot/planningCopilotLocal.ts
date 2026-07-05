import type { PlanningCopilotReply, PlanningCopilotSnapshot } from '@/types/planningCopilot';
import { proposalsToCopilotActions } from '@/types/planningCopilot';
import { describePlanningScope } from './planningSnapshot';

const normalize = (value: string): string => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const proposalSummary = (snapshot: PlanningCopilotSnapshot): string => {
  const proposal = snapshot.activeProposal;
  if (!proposal) {
    return 'Todavía no hay plan recomendado. Puedo prepararlo para las limpiezas de esta vista.';
  }

  const largeHouseAssignments = proposal.proposals.filter((item) => (item.requiredCleaners || 1) > 1).length;
  return [
    `Plan activo: ${proposal.proposals.length} asignaciones preparadas y ${proposal.conflicts.length} pendientes para decidir.`,
    largeHouseAssignments > 0 ? `${largeHouseAssignments} asignaciones son de casas grandes o equipos multi-persona.` : null,
    'Nada se guarda hasta que confirmes el plan.',
  ].filter(Boolean).join(' ');
};

const conflictSummary = (snapshot: PlanningCopilotSnapshot): string => {
  const proposalConflicts = snapshot.activeProposal?.conflicts || [];
  if (proposalConflicts.length === 0 && snapshot.summary.conflictTasks === 0) {
    return 'No veo pendientes importantes en esta vista. Si quieres, puedo recalcular un plan recomendado para confirmarlo.';
  }

  const conflictLines = proposalConflicts.slice(0, 5).map((conflict) => `• ${conflict.message}`).join('\n');
  return `Veo ${snapshot.summary.conflictTasks} limpiezas con algo a revisar y ${proposalConflicts.length} pendientes en el plan activo.${conflictLines ? `\n${conflictLines}` : ''}`;
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
        ? `Para guardar con seguridad, pulsa “Revisar y confirmar” en el plan recomendado. Alcance actual: ${scope}.`
        : `Aún no hay plan para guardar. Primero genera un plan desde el botón principal para: ${scope}.`,
      actions: snapshot.activeProposal ? proposalsToCopilotActions(snapshot.activeProposal.proposals) : [],
      shouldOpenConfirmation: Boolean(snapshot.activeProposal?.proposals.length),
    };
  }

  if (text.includes('conflicto') || text.includes('riesgo') || text.includes('revision') || text.includes('pendiente')) {
    return {
      message: `${conflictSummary(snapshot)}\n\nEstoy mirando: ${scope}.`,
      actions: snapshot.activeProposal ? proposalsToCopilotActions(snapshot.activeProposal.proposals) : [],
    };
  }

  if (text.includes('planifica') || text.includes('propuesta') || text.includes('asigna') || text.includes('recalcula')) {
    return {
      message: `Voy a preparar un plan recomendado para: ${scope}. Priorizaré entradas tempranas, limpiadoras habituales, casas grandes con equipo y evitaré sobrecargar a nadie.`,
      actions: [],
      shouldGenerateProposal: true,
    };
  }

  if (text.includes('resumen') || text.includes('estado')) {
    return {
      message: [
        `Resumen: ${scope}.`,
        `${snapshot.summary.unassignedTasks} sin responsable, ${snapshot.summary.assignedTasks} ya cubiertas, ${snapshot.summary.earlyCheckInTasks} entradas tempranas y ${snapshot.summary.largeHouseTasks} casas grandes.`,
        proposalSummary(snapshot),
      ].join(' '),
      actions: snapshot.activeProposal ? proposalsToCopilotActions(snapshot.activeProposal.proposals) : [],
    };
  }

  return {
    message: [
      `Estoy mirando: ${scope}.`,
      'Puedes pedirme “planifica”, “explica pendientes” o “resumen”.',
      'Yo preparo el plan; tú confirmas antes de guardar y notificar.',
    ].join(' '),
    actions: snapshot.activeProposal ? proposalsToCopilotActions(snapshot.activeProposal.proposals) : [],
  };
};
