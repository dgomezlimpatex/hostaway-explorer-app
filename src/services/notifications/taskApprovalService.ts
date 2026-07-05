// Servicio de transiciones de aprobación de tareas (frontend).
// Los constructores puros viven en approvalPatches.ts (testeables sin Supabase).

import { supabase } from '@/integrations/supabase/client';
import {
  buildPendingApprovalPatch,
  buildReapprovalPatch,
  buildNotRequiredPatch,
  type TaskApprovalPatch,
} from './approvalPatches';

export {
  buildPendingApprovalPatch,
  buildReapprovalPatch,
  buildNotRequiredPatch,
};
export type { TaskApprovalPatch };

/** Aplica un patch de aprobación a una tarea concreta. No lanza. */
export async function applyApprovalPatch(taskId: string, patch: TaskApprovalPatch): Promise<boolean> {
  try {
    const { error } = await supabase.from('tasks').update(patch).eq('id', taskId);
    if (error) {
      console.error('applyApprovalPatch error:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error('applyApprovalPatch exception:', e);
    return false;
  }
}

/** Override administrativo: aprobar manualmente sin pasar por la limpiadora. */
export async function adminApproveTask(taskId: string): Promise<boolean> {
  return applyApprovalPatch(taskId, {
    approval_status: 'auto_approved_by_admin',
    approved_at: new Date().toISOString(),
    approval_response_source: 'admin',
  });
}
