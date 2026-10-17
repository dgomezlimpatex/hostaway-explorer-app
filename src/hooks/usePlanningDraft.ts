import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  EMPTY_DRAFT_VIEW,
  PlanningDraftManager,
  getBrowserDraftStorage,
  type DraftView,
} from '@/utils/cleaning-planning/planningDraftManager';
import type { DraftIdentity } from '@/utils/cleaning-planning/planningDraftStore';

/** Un gestor de borradores por pantalla: vacía lo pendiente al salir y escucha a otras pestañas. */
export const usePlanningDraftManager = (): PlanningDraftManager => {
  const [manager] = useState(() => new PlanningDraftManager({ storage: getBrowserDraftStorage() }));
  useEffect(() => {
    manager.attach();
    return () => manager.detach();
  }, [manager]);
  return manager;
};

/** Estado del borrador de una identidad (usuario + sede + rango), releído al cambiar de identidad. */
export const usePlanningDraftView = (manager: PlanningDraftManager, identity: DraftIdentity | null): DraftView => {
  const view = useSyncExternalStore(
    manager.subscribe,
    () => (identity ? manager.getView(identity) : EMPTY_DRAFT_VIEW),
  );
  const userId = identity?.userId;
  const sedeId = identity?.sedeId;
  const startDate = identity?.startDate;
  const endDate = identity?.endDate;
  useEffect(() => {
    if (userId && sedeId && startDate && endDate) manager.refresh({ userId, sedeId, startDate, endDate });
  }, [manager, userId, sedeId, startDate, endDate]);
  return view;
};
