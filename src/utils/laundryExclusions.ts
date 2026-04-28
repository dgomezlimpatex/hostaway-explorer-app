/**
 * Reglas de exclusión para sistemas de lavandería y control de mudas.
 *
 * Las tareas asignadas al trabajador "NOT COUNT" representan limpiezas que
 * NO se realizan físicamente (se imputan a NOT COUNT por motivos externos),
 * por lo que no requieren reposición de mudas y deben excluirse tanto del
 * enlace público de lavandería como del control de mudas.
 */

export const NOT_COUNT_CLEANER_NAME = 'NOT COUNT';

const normalize = (value: string | null | undefined): string =>
  (value || '').trim().toUpperCase();

/**
 * Devuelve true si la tarea está asignada al trabajador NOT COUNT
 * (y por tanto debe excluirse de los flujos de lavandería).
 */
export const isNotCountCleaner = (cleaner: string | null | undefined): boolean => {
  return normalize(cleaner) === NOT_COUNT_CLEANER_NAME;
};

/**
 * Filtra una lista de tareas eliminando las asignadas a NOT COUNT.
 * Acepta cualquier objeto con un campo `cleaner` (string).
 */
export const excludeNotCountTasks = <T extends { cleaner?: string | null }>(
  tasks: T[] | null | undefined,
): T[] => {
  return (tasks || []).filter(t => !isNotCountCleaner(t.cleaner));
};
