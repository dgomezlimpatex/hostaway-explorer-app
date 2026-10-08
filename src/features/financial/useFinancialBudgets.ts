import { useQuery } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { readAllPages } from './financialSource';
import { readBudgetProjection, type FinancialBudget } from './financialBudget';

const database = supabase as unknown as SupabaseClient;
// Read existing estimates under the caller's RLS. This module deliberately has
// no activation, update or PDF registration path from the estimator service.
export function useFinancialBudgets(sedeId: string, enabled: boolean, selected: string) {
  const list = useQuery({ queryKey: ['financial-budgets', sedeId], enabled, refetchOnWindowFocus: false,
    queryFn: () => readAllPages<FinancialBudget>((from, to) => database.from('tourist_budgets').select('id,title,quote_number,client_id,status,current_version_number').eq('sede_id', sedeId).order('id').range(from, to)) });
  const budget = list.data?.find(row => row.id === selected);
  const detail = useQuery({ queryKey: ['financial-budget-projection', sedeId, budget?.id, budget?.current_version_number], enabled: enabled && !!budget, refetchOnWindowFocus: false,
    queryFn: async () => {
      const version = await database.from('tourist_budget_versions').select('id').eq('budget_id', budget!.id).eq('version_number', budget!.current_version_number).single();
      if (version.error) throw new Error(version.error.message);
      const items = await readAllPages<{ property_id: string | null; result_snapshot: unknown }>((from, to) => database.from('tourist_budget_items').select('property_id,result_snapshot').eq('budget_version_id', version.data.id).order('id').range(from, to));
      return readBudgetProjection(items);
    } });
  return { list, detail, budget };
}
