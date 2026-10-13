import { supabase } from '@/integrations/supabase/client';
export type CountKind = 'clean' | 'installed' | 'dirty' | 'outside' | 'rejected' | 'collected';
export type OpeningCount = { productId: string; warehouseId?: string | null; propertyId?: string | null; kind: CountKind; quantity: number; preparedQuantity?: number };
export type CountRequirement = Omit<OpeningCount, 'quantity' | 'preparedQuantity'> & { key: string; productName: string; locationName: string; quantity: number | null; preparedQuantity?: number | null };
export type CycleBag = { id: string; task_key: string; property_code: string; state: 'prepared' | 'delivered'; lines: { productId: string; quantity: number }[] };
export type CycleState = {
 config: { active: boolean; start_date: string; central_id: string; collection_mode: 'all' | 'one'; collection_destination: 'central' | 'laundry'; rejection_mode:'immediate'|'central'; strict_receipts: boolean; opened_at: string | null } | null;
 scope: string[]; bags: CycleBag[]; outside: { product_id: string; quantity: number }[]; collected: { product_id: string; quantity: number }[];
 dirty: { property_id: string; product_id: string; quantity: number }[];
 rejected: {product_id:string;current_quantity:number}[];
 issues: { id: string; task_key: string | null; code: string; detail: string }[];
 requirements: CountRequirement[]; openingRows: number;
 adoptableBags: { taskId: string; propertyCode: string; date: string; lines: { productId: string; quantity: number }[] }[];
};
export type CycleStock = { active: boolean; levels: { warehouseId: string; productId: string; quantity: number; reserved: number }[]; tasks: { taskId: string; state: 'pending' | 'prepared' | 'delivered' | 'review' | 'issue'; lines: { productId: string; quantity: number }[] }[] };
export async function readCycleStock(sedeId: string, from: string, to: string): Promise<CycleStock> {
 try { return await cycleRpc<CycleStock>('laundry_cycle_stock_checked', { _sede: sedeId, _from: from, _to: to }); }
 catch (error) { if (['PGRST202','42883'].includes(String((error as Error & {code?:string}).code))) return {active:false,levels:[],tasks:[]}; throw error; }
}
type Rpc = { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }> };
const client = supabase as unknown as Rpc;
export async function cycleRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
 const { data, error } = await client.rpc(name, args);
 if (error) throw Object.assign(new Error(error.message), { code: error.code });
 return data as T;
}
export function buildOpeningCounts(requirements: CountRequirement[], values: Record<string, string>, prepared: Record<string, string>): OpeningCount[] {
 if (!requirements.length) throw new Error('Primero guarda el alcance del circuito.');
 return requirements.map(row => {
  const text = values[row.key]; const prep = prepared[row.key];
  if (text == null || !/^\d+$/.test(text) || !Number.isSafeInteger(Number(text))) throw new Error('Completa cada cantidad; un campo vacío no significa cero.');
  if (row.kind === 'clean' && (prep == null || !/^\d+$/.test(prep) || !Number.isSafeInteger(Number(prep)) || Number(prep) > Number(text))) throw new Error('Cuenta las unidades ya preparadas, incluidas en el total limpio.');
  return { productId: row.productId, warehouseId: row.warehouseId, propertyId: row.propertyId, kind: row.kind, quantity: Number(text), ...(row.kind === 'clean' ? { preparedQuantity: Number(prep) } : {}) };
 });
}
