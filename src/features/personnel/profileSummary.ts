import type { HoursSummary } from "./hours";

/** Tareas cuyo horario ya pasó y no constan como completadas (no es un indicador de rendimiento). */
export const pastUncompletedTaskCount = (summary: Pick<HoursSummary, "lines">): number =>
  new Set(
    summary.lines
      .filter((l) => l.source === "task" && l.phase === "elapsed" && l.status !== "completed")
      .map((l) => l.sourceId),
  ).size;
