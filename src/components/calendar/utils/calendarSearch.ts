import { Task } from "@/types/calendar";

const normalize = (s: string | null | undefined): string =>
  (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const taskMatches = (
  task: Task,
  term: string,
  clientNameById?: Map<string, string>
): boolean => {
  if (!term) return true;
  const t = normalize(term);
  const clientName = task.clienteId ? clientNameById?.get(task.clienteId) : undefined;
  const haystack = [
    task.property,
    task.propertyCode,
    task.address,
    task.client,
    clientName,
    task.type,
    task.cleaner,
  ]
    .map(normalize)
    .join(" | ");
  return haystack.includes(t);
};

export const cleanerNameMatches = (name: string, term: string): boolean => {
  if (!term) return true;
  return normalize(name).includes(normalize(term));
};

const assignedIds = (task: Task): string[] => {
  const ids = (task.assignments || []).map((assignment) => assignment.cleaner_id).filter(Boolean);
  return Array.from(new Set(ids.length > 0 ? ids : [task.cleanerId].filter(Boolean) as string[]));
};

/**
 * Calendar filters (client, cleaner, free text).
 * - Unassigned tasks have no cleaner, so the cleaner filter keeps them (the
 *   panel says so), but the client filter and the search apply to them too:
 *   searching a property shows only that property in the unassigned panel.
 * - Assigned tasks match by their fields or by the name of any assigned person.
 */
export const filterCalendarTasks = (
  tasks: Task[],
  {
    term = '',
    clientIds,
    cleanerIds,
    matchingCleanerIds,
    clientNameById,
  }: {
    term?: string;
    clientIds?: Set<string>;
    cleanerIds?: Set<string>;
    matchingCleanerIds?: Set<string> | null;
    clientNameById?: Map<string, string>;
  },
): Task[] => {
  const search = term.trim();
  const hasClientFilter = !!clientIds && clientIds.size > 0;
  const hasCleanerFilter = !!cleanerIds && cleanerIds.size > 0;
  if (!hasClientFilter && !hasCleanerFilter && !search) return tasks;

  return tasks.filter((task) => {
    const ids = assignedIds(task);
    if (hasClientFilter && (!task.clienteId || !clientIds!.has(task.clienteId))) return false;
    if (hasCleanerFilter && ids.length > 0 && !ids.some((id) => cleanerIds!.has(id))) return false;
    if (search) {
      const fieldHit = taskMatches(task, search, clientNameById);
      if (ids.length === 0) return fieldHit;
      const cleanerHit = ids.some((id) => matchingCleanerIds?.has(id) ?? false);
      if (!cleanerHit && !fieldHit) return false;
    }
    return true;
  });
};
