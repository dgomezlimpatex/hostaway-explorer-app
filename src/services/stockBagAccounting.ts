import { cycleRpc } from './laundryCycleService';
import type { StockAdjustmentData } from '@/types/stock';
export interface BagAccountingState {
 active: boolean;
 config: { central_id: string; start_date: string; active: boolean } | null;
 bags: { task_key: string; property_code: string; taskStatus: string | null; taskDate:string|null; delivered: boolean; lines: Record<string, number> }[];
}
export interface BagAccountingPreview {
 fingerprint: string; startDate: string; centralId: string;
 rows: { productId: string; name: string; sourceKey: string; introduced: number; prepared: number; proposed: number; untrackedBags: number; registered: number | null; version: number | null }[];
 bags: unknown[];
}
export async function readBagAccounting(sede: string): Promise<BagAccountingState> {
 try { return await cycleRpc('read_stock_bag_accounting_checked', { _sede: sede }); }
 catch (error) { if (['PGRST202', '42883'].includes(String((error as {code?: string}).code))) return { active: false, config: null, bags: [] }; throw error; }
}

export interface PendingBagOperation { name: string; args: Record<string, unknown>; }
export const bagOperationKey = (scope: string) => `stock-bag-operation-v1:${scope}`;
export function readPendingBagOperation(scope: string): PendingBagOperation | null {
 try { return JSON.parse(localStorage.getItem(bagOperationKey(scope)) || 'null'); } catch { return null; }
}
export function persistBagOperation(scope: string, operation: PendingBagOperation | null) {
 if (operation) localStorage.setItem(bagOperationKey(scope), JSON.stringify(operation));
 else localStorage.removeItem(bagOperationKey(scope));
}
export async function runBagOperation<T>(scope: string, operation: PendingBagOperation): Promise<T> {
 persistBagOperation(scope, operation);
 try {
  const answer = await cycleRpc<T>(operation.name, operation.args);
  persistBagOperation(scope, null);
  return answer;
 } catch (error) {
  // These SQL rejections roll back their transaction. A transport failure may
  // have committed, so retain the original request and identity for retry.
  if (['40001','P0001','42501','23514','23503','23505','22023','22P02'].includes(String((error as {code?:string}).code))) persistBagOperation(scope,null);
  throw error;
 }
}
export async function adjustBagStock(input: StockAdjustmentData): Promise<Record<string,unknown>> {
 const scope=`adjust:${input.user_id}:${input.stock_level.id}`;
 const args={_level:input.stock_level.id,_kind:input.movement_type,_quantity:input.quantity,_reason:input.reason.trim(),_cost:input.cost_per_unit??null,
  _version:input.stock_level.stock_version,_verified:input.verified_count===true,_operation:input.operation_key??crypto.randomUUID()};
 const pending=readPendingBagOperation(scope);
 if(pending) {
  const sameIntent=['_level','_kind','_quantity','_reason','_cost','_verified'].every(key=>pending.args[key]===args[key as keyof typeof args]);
  if(!sameIntent) throw new Error('Hay un movimiento pendiente de confirmar para este producto. Reintenta ese movimiento antes de introducir otro.');
 }
 if(args._version===undefined && !pending) throw new Error('Actualiza Inventario antes de guardar: falta la versión del saldo.');
 return runBagOperation(scope,pending??{name:'adjust_bag_stock_checked',args});
}
