import type {
  AssignmentConflict,
  AssignmentProposal,
  GlobalPlanQualitySummary,
} from '../../types/cleaningPlanning';

export interface PlanQualityBundleInput {
  bundleId: string;
  propertyGroupName: string;
  taskIds: string[];
  hadFullBundleCandidate: boolean;
  hadNonBackupFullCandidate: boolean;
  splitReason?: string;
  latestFinishTime?: string;
}

const timeToMinutes = (time?: string): number | null => {
  if (!time) return null;
  const [rawHours, rawMinutes = '0'] = time.split(':');
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

const unique = <T>(values: T[]): T[] => Array.from(new Set(values));

export const buildGlobalPlanQualitySummary = ({
  bundles,
  proposals,
  conflicts,
  additionalWarnings = [],
}: {
  bundles: PlanQualityBundleInput[];
  proposals: AssignmentProposal[];
  conflicts: AssignmentConflict[];
  additionalWarnings?: string[];
}): GlobalPlanQualitySummary => {
  const proposalsByBundle = new Map<string, AssignmentProposal[]>();
  for (const proposal of proposals) {
    const key = proposal.bundleId || `${proposal.propertyGroupId || 'sin-edificio'}:${proposal.taskId}`;
    proposalsByBundle.set(key, [...(proposalsByBundle.get(key) || []), proposal]);
  }

  let fullBundlesCovered = 0;
  let splitBundles = 0;
  let avoidableSplits = 0;
  let nearCheckInTasks = 0;
  const criticalWarnings: string[] = [...additionalWarnings];

  for (const bundle of bundles) {
    const bundleProposals = proposalsByBundle.get(bundle.bundleId) || [];
    const proposedTaskIds = unique(bundleProposals.map((proposal) => proposal.taskId));
    const cleanerIds = unique(bundleProposals.map((proposal) => proposal.cleanerId));
    const isFullyCovered = proposedTaskIds.length === bundle.taskIds.length;
    const isSplit = isFullyCovered && cleanerIds.length > 1;

    if (isFullyCovered && cleanerIds.length === 1) {
      fullBundlesCovered += 1;
    }

    if (isSplit) {
      splitBundles += 1;
      if (bundle.hadFullBundleCandidate) {
        avoidableSplits += 1;
        criticalWarnings.push(`${bundle.propertyGroupName} está dividido aunque existía una trabajadora capaz de cubrir el centro completo.`);
      } else {
        criticalWarnings.push(bundle.splitReason || `${bundle.propertyGroupName} se divide porque ninguna trabajadora puede cubrir el centro completo dentro de disponibilidad y checkout–checkin.`);
      }
    }

    const latestFinishMinutes = timeToMinutes(bundle.latestFinishTime);
    if (latestFinishMinutes !== null) {
      for (const proposal of bundleProposals) {
        const proposedEndMinutes = timeToMinutes(proposal.proposedEndTime);
        if (proposedEndMinutes !== null && latestFinishMinutes - proposedEndMinutes <= 15) {
          nearCheckInTasks += 1;
          criticalWarnings.push(`${bundle.propertyGroupName} tiene una limpieza propuesta muy cerca del check-in (${proposal.proposedEndTime}).`);
        }
      }
    }
  }

  const backupAssignments = proposals.filter((proposal) => proposal.assignmentRole === 'backup').length;
  const avoidableBackupAssignments = proposals.filter((proposal) => proposal.assignmentRole === 'backup')
    .filter((proposal) => {
      const bundle = bundles.find((item) => item.bundleId === proposal.bundleId);
      return Boolean(bundle?.hadNonBackupFullCandidate);
    }).length;

  if (avoidableBackupAssignments > 0) {
    criticalWarnings.push(`${avoidableBackupAssignments} asignación(es) usan backup aunque había titular/suplente viable para el paquete.`);
  }

  const globalScore = Math.max(0, Math.round(
    proposals.length * 1000
    + fullBundlesCovered * 250
    - splitBundles * 120
    - avoidableSplits * 300
    - backupAssignments * 40
    - avoidableBackupAssignments * 200
    - nearCheckInTasks * 120
    - conflicts.length * 250,
  ));

  return {
    fullBundlesCovered,
    splitBundles,
    avoidableSplits,
    backupAssignments,
    avoidableBackupAssignments,
    nearCheckInTasks,
    manualDecisionCount: conflicts.length,
    globalScore,
    criticalWarnings: unique(criticalWarnings).slice(0, 8),
  };
};
