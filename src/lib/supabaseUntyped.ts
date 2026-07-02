import { supabase } from '@/integrations/supabase/client';

export function fromUntypedTable(table: string) {
  return supabase.from(table as never);
}

export function rpcUntyped<TArgs extends Record<string, unknown>>(fn: string, args: TArgs) {
  return supabase.rpc(fn as never, args as never);
}
