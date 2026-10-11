import { memo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Cleaner, Task } from "@/types/calendar";
import type { DragState } from "@/hooks/useDragAndDrop";
import { WorkloadSummary } from "@/types/workload";
import { getClientColor } from "@/utils/clientColors";
import {
  CalendarDayTask,
  CleanerDayCells,
  canDropOnDay,
  civilDateToLocalDate,
} from "./utils/multiDayCalendar";

interface MultiDayCalendarGridProps {
  cleaners: Cleaner[];
  days: string[];
  cells: CleanerDayCells;
  todayStr: string;
  dragState: DragState;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, cleanerId: string, cleaners: Cleaner[], timeSlot?: string) => void;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onTaskClick: (task: Task) => void;
  onSelectDay: (day: string) => void;
  assignmentsMap?: Record<string, string[]>;
  workloadMap?: Record<string, WorkloadSummary>;
  preferredCleanerIds?: Set<string>;
}

const STATUS_DOT: Record<string, string> = {
  completed: "bg-success",
  "in-progress": "bg-warning",
  pending: "bg-danger",
};

const formatTime = (time: string) => time.slice(0, 5);

const getInitials = (name: string) =>
  name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

const DayTaskChip = ({
  entry,
  assignedCount,
  isBeingDragged,
  onTaskClick,
  onDragStart,
  onDragEnd,
}: {
  entry: CalendarDayTask;
  assignedCount: number;
  isBeingDragged: boolean;
  onTaskClick: (task: Task) => void;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onDragEnd: (e: React.DragEvent) => void;
}) => {
  const { task, displayEndTime, hasOverlap } = entry;
  const color = getClientColor(task.clienteId);
  const isSplit = assignedCount > 1;

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      data-task-id={task.id}
      onClick={() => onTaskClick(task)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onTaskClick(task);
        }
      }}
      onDragStart={(e) => {
        e.stopPropagation();
        onDragStart(e, task);
      }}
      onDragEnd={onDragEnd}
      title={[
        `${task.property} · ${formatTime(task.startTime)}–${formatTime(task.endTime)}`,
        isSplit ? `Dividido entre ${assignedCount} personas (${formatTime(displayEndTime)} por persona)` : null,
        hasOverlap ? "Conflicto de horario con otra tarea del día" : null,
      ].filter(Boolean).join("\n")}
      className={cn(
        "group relative rounded-md border border-l-4 px-2 py-1 text-left text-[11px] leading-tight shadow-sm cursor-move select-none",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        task.isRecurringInstance && "border-dashed",
        hasOverlap && "ring-2 ring-danger",
        isBeingDragged && "opacity-30",
      )}
      style={{ backgroundColor: color.bg, borderLeftColor: color.border, color: color.text }}
    >
      <div className="flex items-center gap-1 font-semibold tabular-nums">
        <span
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[task.status] ?? "bg-ink-4")}
          aria-hidden
        />
        <span>{formatTime(task.startTime)}–{formatTime(displayEndTime)}</span>
        {task.isRecurringInstance && <RefreshCw className="h-2.5 w-2.5 shrink-0" aria-label="Recurrente" />}
        {hasOverlap && <AlertTriangle className="h-3 w-3 shrink-0 text-danger" aria-label="Conflicto de horario" />}
        {isSplit && <span className="ml-auto text-[9px] font-bold">÷{assignedCount}</span>}
      </div>
      <div className="truncate font-medium">{task.property}</div>
    </div>
  );
};

export const MultiDayCalendarGrid = memo(({
  cleaners,
  days,
  cells,
  todayStr,
  dragState,
  onDragOver,
  onDrop,
  onDragStart,
  onDragEnd,
  onTaskClick,
  onSelectDay,
  assignmentsMap,
  workloadMap,
  preferredCleanerIds,
}: MultiDayCalendarGridProps) => {
  const draggedTask = dragState.draggedTask;
  const isDragging = dragState.isDragging && !!draggedTask;
  const hasPreferred = isDragging && !!preferredCleanerIds && preferredCleanerIds.size > 0;

  const dayTotals = days.map((day) => {
    const ids = new Set<string>();
    cleaners.forEach((cleaner) => cells[cleaner.id]?.[day]?.forEach((entry) => ids.add(entry.task.id)));
    return ids.size;
  });

  const gridTemplateColumns = `14rem repeat(${days.length}, minmax(9.5rem, 1fr))`;

  return (
    <div className="flex-1 min-h-0 overflow-auto rounded-md border border-border bg-card shadow-xl" data-testid="multi-day-grid">
      <div className="grid min-w-max" style={{ gridTemplateColumns }}>
        {/* Cabecera */}
        <div className="sticky left-0 top-0 z-30 flex h-12 items-center border-b border-r border-border bg-muted px-3">
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Equipo</span>
        </div>
        {days.map((day, index) => {
          const date = civilDateToLocalDate(day);
          const isToday = day === todayStr;
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelectDay(day)}
              title="Ver este día con horario detallado"
              className={cn(
                "sticky top-0 z-20 flex h-12 flex-col items-center justify-center border-b border-r border-border bg-muted text-xs hover:bg-accent",
                isToday && "bg-primary/10 text-primary",
              )}
            >
              <span className="font-semibold capitalize">
                {format(date, "EEE d", { locale: es })}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {dayTotals[index]} {dayTotals[index] === 1 ? "servicio" : "servicios"}
              </span>
            </button>
          );
        })}

        {/* Filas */}
        {cleaners.map((cleaner, rowIndex) => {
          const workload = workloadMap?.[cleaner.id];
          const isPreferred = hasPreferred && preferredCleanerIds!.has(cleaner.id);
          const isDimmed = hasPreferred && !preferredCleanerIds!.has(cleaner.id);
          const rowBg = rowIndex % 2 === 0 ? "bg-background" : "bg-muted/30";
          const hue = (cleaner.name.charCodeAt(0) * 37) % 360;

          return (
            <div key={cleaner.id} className={cn("contents", isDimmed && "[&>*]:opacity-40")} data-cleaner-row={cleaner.id}>
              <div
                className={cn(
                  "sticky left-0 z-10 flex min-h-16 items-center gap-2 border-b border-r border-border px-3 py-1.5",
                  rowBg,
                  isPreferred && "bg-surface ring-2 ring-inset ring-warning",
                )}
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: `hsl(${hue}, 60%, 50%)` }}
                  aria-hidden
                >
                  {getInitials(cleaner.name)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-foreground">{cleaner.name}</div>
                  {workload && (
                    <div className="text-[11px] tabular-nums text-muted-foreground">
                      {workload.totalWorked.toFixed(1)}
                      {workload.contractHoursPerWeek > 0 ? ` / ${workload.contractHoursPerWeek} h` : " h · Sin contrato"}
                    </div>
                  )}
                </div>
              </div>

              {days.map((day) => {
                const entries = cells[cleaner.id]?.[day] ?? [];
                const allowsDrop = isDragging && canDropOnDay(draggedTask, day);
                const blocksDrop = isDragging && !allowsDrop;
                return (
                  <div
                    key={day}
                    data-day={day}
                    className={cn(
                      "min-h-16 space-y-1 border-b border-r border-border p-1 transition-colors",
                      rowBg,
                      day === todayStr && "bg-primary/5",
                      allowsDrop && "hover:bg-accent/60",
                      blocksDrop && "bg-muted/60",
                    )}
                    onDragOver={(e) => {
                      if (!canDropOnDay(draggedTask, day)) return;
                      onDragOver(e);
                    }}
                    onDrop={(e) => {
                      if (!canDropOnDay(draggedTask, day)) return;
                      onDrop(e, cleaner.id, cleaners);
                    }}
                  >
                    {entries.map((entry) => (
                      <DayTaskChip
                        key={entry.task.id}
                        entry={entry}
                        assignedCount={assignmentsMap?.[entry.task.id]?.length ?? 1}
                        isBeingDragged={draggedTask?.id === entry.task.id}
                        onTaskClick={onTaskClick}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {cleaners.length === 0 && (
        <div className="p-6 text-center text-sm text-muted-foreground">No hay trabajadoras para mostrar.</div>
      )}
    </div>
  );
});

MultiDayCalendarGrid.displayName = "MultiDayCalendarGrid";
