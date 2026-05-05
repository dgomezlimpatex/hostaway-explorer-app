import { Task } from "@/types/calendar";

const normalize = (s: string | null | undefined): string =>
  (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const taskMatches = (task: Task, term: string): boolean => {
  if (!term) return true;
  const t = normalize(term);
  const haystack = [
    task.property,
    task.propertyCode,
    task.address,
    task.client,
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
