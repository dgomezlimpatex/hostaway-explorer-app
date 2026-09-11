import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useCleaners } from "@/hooks/useCleaners";
import { useAuth } from "@/hooks/useAuth";
import { useSede } from "@/contexts/SedeContext";
import {
  buildRecurringExecutionSet,
  recurringExecutionBounds,
  RecurringExecution,
} from "@/utils/recurringExecutions";
import {
  Adjustment,
  AssignedTask,
  ContractVersion,
  HoursData,
  Period,
  ScheduleVersion,
} from "./hours";

// Additive history tables have their own DTOs until the generated schema is refreshed.
const db: SupabaseClient = supabase;
import { allPages } from "./pagination";
const taskFields =
  "id,cleaner_id,property,date,start_time,end_time,duracion,status,type,task_assignments(cleaner_id)";
async function loadAssignedTasks(
  sedeId: string,
  ids: string[],
  period: Pick<Period, "from" | "to">,
): Promise<AssignedTask[]> {
  // Filter ownership on the server, including shared assignments and the legacy primary owner.
  // This keeps a person's twelve-month history from downloading the entire site's task history.
  const [assigned, legacy] = await Promise.all([
    allPages<{ task: AssignedTask }>((a, b) =>
      db
        .from("task_assignments")
        .select(`id,task:tasks!inner(${taskFields})`)
        .in("cleaner_id", ids)
        .eq("task.sede_id", sedeId)
        .gte("task.date", period.from)
        .lte("task.date", period.to)
        .order("id")
        .range(a, b),
    ),
    allPages<AssignedTask>((a, b) =>
      db
        .from("tasks")
        .select(taskFields)
        .in("cleaner_id", ids)
        .eq("sede_id", sedeId)
        .gte("date", period.from)
        .lte("date", period.to)
        .order("id")
        .range(a, b),
    ),
  ]);
  return [
    ...new Map(
      [...legacy, ...assigned.map((row) => row.task)]
        .filter(Boolean)
        .map((task) => [task.id, task]),
    ).values(),
  ];
}
export async function loadPersonnelHours(
  sedeId: string,
  ids: string[],
  period: Pick<Period, "from" | "to">,
): Promise<HoursData> {
  if (!ids.length)
    return {
      tasks: [],
      contracts: [],
      schedules: [],
      adjustments: [],
      executions: new Set(),
    };
  const [tasks, contracts, schedules, adjustments] = await Promise.all([
    loadAssignedTasks(sedeId, ids, period),
    allPages<ContractVersion>((a, b) =>
      db
        .from("worker_contract_hours_history")
        .select("*")
        .in("cleaner_id", ids)
        .lte("effective_date", period.to)
        .order("id")
        .range(a, b),
    ),
    allPages<ScheduleVersion>((a, b) =>
      db
        .from("worker_schedule_history")
        .select("*")
        .in("cleaner_id", ids)
        .lte("effective_date", period.to)
        .order("id")
        .range(a, b),
    ),
    allPages<Adjustment>((a, b) =>
      db
        .from("worker_hour_adjustments")
        .select("*")
        .in("cleaner_id", ids)
        .gte("date", period.from)
        .lte("date", period.to)
        .order("id")
        .range(a, b),
    ),
  ]);
  const recurringIds = [
    ...new Set(
      schedules
        .filter((v) => v.source_type === "recurring")
        .map((v) => v.source_id),
    ),
  ];
  const bounds = recurringExecutionBounds(period.from, period.to);
  const executions: RecurringExecution[] = [];
  for (let i = 0; i < recurringIds.length; i += 100)
    executions.push(
      ...(await allPages<RecurringExecution>((a, b) =>
        db
          .from("recurring_task_executions")
          .select("id,recurring_task_id,execution_date")
          .in("recurring_task_id", recurringIds.slice(i, i + 100))
          .eq("success", true)
          .gte("execution_date", bounds.from)
          .lt("execution_date", bounds.until)
          .order("id")
          .range(a, b),
      )),
    );
  return {
    tasks,
    contracts,
    schedules,
    adjustments,
    executions: buildRecurringExecutionSet(executions),
  };
}
export function usePersonnelData(
  period: Pick<Period, "from" | "to">,
  workerId?: string,
) {
  const { cleaners, isLoading, error: cleanersError } = useCleaners();
  const { activeSede } = useSede();
  const { userRole } = useAuth();
  const people = workerId
    ? cleaners.filter((c) => c.id === workerId)
    : cleaners;
  const canManage = userRole === "admin" || userRole === "manager";
  const query = useQuery({
    queryKey: [
      "workload",
      "personnel",
      activeSede?.id,
      period.from,
      period.to,
      workerId,
      people.map((p) => `${p.id}:${p.contractHoursPerWeek}`).join("|"),
    ],
    queryFn: () =>
      loadPersonnelHours(
        activeSede!.id,
        people.map((p) => p.id),
        period,
      ),
    enabled: canManage && !!activeSede?.id && !isLoading && people.length > 0,
    refetchInterval: 30000,
    staleTime: 10000,
  });
  return {
    ...query,
    error: query.error || cleanersError,
    people,
    canManage,
    isLoading: isLoading || query.isLoading,
  };
}
export interface AdjustmentAudit {
  id: number;
  action: string;
  old_data: Adjustment | null;
  new_data: Adjustment | null;
  changed_at: string;
  changed_by: string | null;
  author_name?: string;
}
export function useAdjustmentAudit(id: string) {
  return useQuery({
    queryKey: ["workload", "personnel-audit", id],
    enabled: !!id,
    queryFn: async () => {
      const rows = await allPages<AdjustmentAudit>((a, b) =>
        db
          .from("worker_hours_adjustment_audit")
          .select("*")
          .eq("cleaner_id", id)
          .order("id", { ascending: false })
          .range(a, b),
      );
      const ids = [...new Set(rows.map((r) => r.changed_by).filter(Boolean))];
      if (!ids.length) return rows;
      const { data: profiles } = await db
        .from("profiles")
        .select("id,full_name")
        .in("id", ids);
      return rows.map((r) => ({
        ...r,
        author_name: profiles?.find((p) => p.id === r.changed_by)?.full_name,
      }));
    },
    refetchInterval: 30000,
  });
}
