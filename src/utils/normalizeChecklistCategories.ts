import type { ChecklistCategory, ChecklistItem } from '@/types/taskReports';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim() ? value : fallback;

const normalizeItem = (value: unknown, fallbackId: string): ChecklistItem | null => {
  if (!record(value)) return null;
  return {
    ...value,
    id: text(value.id, fallbackId),
    task: text(value.task ?? value.label, 'Tarea sin descripción'),
    required: value.required === true,
    photo_required: value.photo_required === true,
  };
};

/** Accept both cleaning categories and the flat task format used by supervision. */
export function normalizeChecklistCategories(value: unknown): ChecklistCategory[] {
  if (!Array.isArray(value)) return [];
  const categories: ChecklistCategory[] = [];
  const flatGroups = new Map<string, ChecklistCategory>();
  value.forEach((entry, index) => {
    if (!record(entry)) return;
    const categoryId = `checklist-category-${index + 1}`;
    // Keep empty/incomplete categories empty; never turn them into phantom tasks.
    if ('items' in entry || (!('task' in entry) && !('label' in entry))) {
      categories.push({
        ...entry,
        id: text(entry.id, categoryId),
        category: text(entry.category ?? entry.name, `Categoría ${index + 1}`),
        items: (Array.isArray(entry.items) ? entry.items : [])
          .map((item, itemIndex) => normalizeItem(item, `${categoryId}-item-${itemIndex + 1}`))
          .filter((item): item is ChecklistItem => item !== null),
      });
      return;
    }
    const name = text(entry.category, 'General');
    let group = flatGroups.get(name);
    if (!group) {
      group = { id: categoryId, category: name, items: [] };
      flatGroups.set(name, group);
      categories.push(group);
    }
    const item = normalizeItem(entry, `checklist-item-${index + 1}`);
    if (item) group.items.push(item);
  });
  return categories;
}
