export interface WorkerScheduleInput {
  startTime?: string | null;
  endTime?: string | null;
  /** Duración total de la tarea, en minutos, cuando está disponible. */
  durationMinutes?: number | null;
}

export interface WorkerSchedule {
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

const MINUTES_PER_DAY = 24 * 60;

const parseTime = (value?: string | null): number | null => {
  if (!value) return null;
  const [rawHours, rawMinutes = '0'] = value.slice(0, 5).split(':');
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const formatTime = (minutes: number): string => {
  const normalized = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(normalized / 60);
  const remainingMinutes = normalized % 60;
  return `${hours.toString().padStart(2, '0')}:${remainingMinutes.toString().padStart(2, '0')}`;
};

/**
 * Regla operativa común: todos empiezan a la misma hora y la duración total
 * se reparte entre el número real de trabajadores asignados.
 */
export function getTaskWorkerSchedule(
  task: WorkerScheduleInput,
  workerCount = 1,
): WorkerSchedule {
  const parsedStartMinutes = parseTime(task.startTime);
  const startMinutes = parsedStartMinutes ?? 0;
  const endMinutes = parseTime(task.endTime);
  const windowDuration = parsedStartMinutes === null || endMinutes === null
    ? 0
    : ((endMinutes - startMinutes) + MINUTES_PER_DAY) % MINUTES_PER_DAY || MINUTES_PER_DAY;
  const declaredDuration = Number(task.durationMinutes);
  // The explicit task schedule is authoritative. `durationMinutes` can still
  // contain a property's old estimate after a manager edits the task times.
  // Only use it when there is no usable schedule window.
  const totalDuration = windowDuration > 0
    ? windowDuration
    : Number.isFinite(declaredDuration) && declaredDuration > 0
      ? Math.round(declaredDuration)
      : 0;
  const normalizedWorkerCount = Number.isFinite(workerCount) && workerCount > 0
    ? Math.max(1, Math.ceil(workerCount))
    : 1;
  const durationMinutes = Math.max(0, Math.ceil(totalDuration / normalizedWorkerCount));

  return {
    startTime: formatTime(startMinutes),
    endTime: formatTime(startMinutes + durationMinutes),
    durationMinutes,
  };
}
