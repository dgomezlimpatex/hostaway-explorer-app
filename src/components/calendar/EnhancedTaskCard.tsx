import React, { useCallback, useEffect, useRef, useState } from "react";
import { Task } from "@/types/calendar";
import { Clock, ListTodo, GripVertical, Pencil, Copy, Trash2, UserMinus, CalendarDays, Timer, Users, Eye } from "lucide-react";
import { TaskStatusBadge } from './TaskStatusBadge';
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useClientData } from "@/hooks/useClientData";
import { getClientColor } from "@/utils/clientColors";
import { useTaskQuickActions } from "@/hooks/useTaskQuickActions";
import { getResizedEndTime, getTaskWidthPx, toMinutes } from "./utils/taskResize";
import { getDisplayStatus } from "@/utils/calendarTaskStatus";
import { shiftCivilDate } from "@/utils/madridCalendar";
import { useCalendarActions } from "./CalendarActionsContext";
import { pixelsPerMinute } from "./utils/timelineScale";

const STATUS_TEXT: Record<string, string> = {
  pending: 'sin iniciar',
  'in-progress': 'en proceso',
  completed: 'finalizada',
  cancelled: 'cancelada',
};

const shortDate = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

const initials = (name: string) =>
  name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 3).toUpperCase();

const dispatchTaskEvent = (name: string, detail: Record<string, unknown>) => {
  window.dispatchEvent(new CustomEvent(name, { detail }));
};

// Subtask badge component
const SubtaskBadge = ({ task }: { task: Task }) => {
  const additionalTasks = task.additionalTasks || [];
  if (additionalTasks.length === 0) return null;

  const pendingCount = additionalTasks.filter(t => !t.completed).length;
  const allCompleted = pendingCount === 0;

  return (
    <div
      className={cn(
        "absolute top-1 right-9 z-20 flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[9px] font-bold shadow-sm",
        allCompleted
          ? "bg-ink-3 text-white"
          : "bg-danger text-white animate-pulse"
      )}
    >
      <ListTodo className="h-2.5 w-2.5" />
      <span>{pendingCount > 0 ? pendingCount : additionalTasks.length}</span>
    </div>
  );
};

interface EnhancedTaskCardProps {
  task: Task;
  /** Receives the task to act on (originalTask when given). */
  onClick?: (task: Task) => void;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent, task: Task, originCleanerId?: string) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  style?: React.CSSProperties;
  /** Disable resize handle and context menu (e.g. unassigned panel). Defaults to false. */
  disableQuickActions?: boolean;
  /**
   * Hide the resize handle. Shared tasks show only one person's share, so
   * stretching that block would save a shorter total end time.
   */
  disableResize?: boolean;
  /**
   * Task passed to onClick/onDragStart when `task` is a display copy (e.g. the
   * per-person block of a shared task). Lets the grid pass stable callbacks.
   */
  originalTask?: Task;
  /**
   * Cleaner row where this block is drawn. A shared task appears in every
   * assigned row: dragging or removing from a row only affects that person.
   */
  rowCleaner?: { id: string; name: string };
  /** Number of people assigned (shared tasks offer actions per person). */
  assignedCount?: number;
  /** Narrow block: only start time and initials (the tooltip keeps the details). */
  compact?: boolean;
}

const formatDuration = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
};

export const EnhancedTaskCard = React.memo(({
  task,
  onClick,
  isDragging,
  onDragStart,
  onDragEnd,
  style,
  disableQuickActions,
  disableResize,
  originalTask,
  rowCleaner,
  assignedCount = 1,
  compact = false
}: EnhancedTaskCardProps) => {
  const actionTask = originalTask ?? task;
  const { getClientName } = useClientData();
  const clientColor = getClientColor(task.clienteId);
  const { permissions, validateScheduleChange, scale } = useCalendarActions();
  const { resizeTask, moveTaskToDate, addTaskDuration } = useTaskQuickActions({ validate: validateScheduleChange });
  const ppm = pixelsPerMinute(scale);

  // Resize state
  const [resizing, setResizing] = useState(false);
  const [previewEndTime, setPreviewEndTime] = useState<string | null>(null);
  const resizeStartX = useRef(0);

  // El estado se muestra aparte del color del cliente, con una sola fuente:
  // el derivado de los partes si existe, si no el estado guardado.
  const displayStatus = getDisplayStatus(task);
  const isCompleted = displayStatus === 'completed';
  const isInProgress = displayStatus === 'in-progress';
  const isCancelled = displayStatus === 'cancelled';
  // Virtual recurring occurrences have no task row yet: quick edits would find
  // nothing to change. They are edited from the details modal instead.
  const isRecurringInstance = Boolean(task.isRecurringInstance);

  const formatTime = (time: string) => {
    if (time.includes(':')) {
      const parts = time.split(':');
      return `${parts[0]}:${parts[1]}`;
    }
    return time;
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (resizing || !permissions.canEdit) {
      e.preventDefault();
      return;
    }
    if (onDragStart) {
      onDragStart(e, actionTask, rowCleaner?.id);
    }
  };

  // ---------- Resize logic ----------
  const handleResizePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    resizeStartX.current = e.clientX;
    setResizing(true);
    setPreviewEndTime(task.endTime);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [task.endTime]);

  useEffect(() => {
    if (!resizing) return;

    // The timeline is horizontal: the right edge sets the end time.
    const handleMove = (e: PointerEvent) => {
      setPreviewEndTime(getResizedEndTime(task.startTime, task.endTime, e.clientX - resizeStartX.current, ppm));
    };

    const handleUp = () => {
      setResizing(false);
      const finalEnd = previewEndTime;
      setPreviewEndTime(null);
      if (finalEnd && finalEnd !== task.endTime) {
        resizeTask(task.id, finalEnd);
      }
    };

    // The browser can cancel the gesture (touch scroll, window change): leave
    // resize mode without saving so the card stays clickable and draggable.
    const handleCancel = () => {
      setResizing(false);
      setPreviewEndTime(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancel();
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleCancel);
    window.addEventListener('blur', handleCancel);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleCancel);
      window.removeEventListener('blur', handleCancel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [resizing, previewEndTime, task.id, task.startTime, task.endTime, resizeTask, ppm]);

  const clientName = getClientName(task.clienteId || '');
  const displayPropertyName = () => task.property;

  const displayedEndTime = previewEndTime || task.endTime;
  const displayedDurationMin = toMinutes(displayedEndTime) - toMinutes(task.startTime);

  // Estilo dinámico: color del cliente como fondo + borde lateral
  const cardStyle: React.CSSProperties = {
    ...style,
    backgroundColor: isCancelled ? undefined : clientColor.bg,
    borderLeftColor: clientColor.border,
    color: clientColor.text,
  };

  // If resizing, we override the visual width to match the preview
  if (resizing && previewEndTime) {
    cardStyle.width = `${getTaskWidthPx(task.startTime, previewEndTime, ppm)}px`;
  }

  const isShared = assignedCount > 1;
  const canResize = permissions.canEdit && !disableQuickActions && !disableResize && !isCancelled && !isRecurringInstance;
  const hasQuickActions = permissions.canEdit || permissions.canCreate || permissions.canDelete;
  const statusText = STATUS_TEXT[displayStatus] ?? 'estado desconocido';
  const ariaLabel = [
    `${task.property}, ${formatTime(task.startTime)} a ${formatTime(task.endTime)}`,
    statusText,
    isShared ? `compartida entre ${assignedCount} personas` : '',
    !disableQuickActions ? 'más acciones con la tecla Menú o Mayúsculas+F10' : '',
  ].filter(Boolean).join(', ');

  const cardElement = (
    <div
      draggable={!resizing && permissions.canEdit}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      data-task-id={task.id}
      onClick={resizing || !onClick ? undefined : () => onClick(actionTask)}
      onKeyDown={(e) => {
        if (!resizing && onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick(actionTask);
        }
      }}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      style={cardStyle}
      className={cn(
        "relative rounded-lg cursor-pointer transition-all duration-200",
        compact ? "px-1 py-1 border-l-[3px]" : "px-2 py-1.5 border-l-[5px]",
        "hover:shadow-md",
        !resizing && "hover:-translate-y-0.5",
        "focus:outline-none focus:ring-2 focus:ring-primary/40",
        "transform-gpu overflow-hidden",
        isCompleted && "ring-2 ring-success ring-offset-0",
        isInProgress && "ring-2 ring-ink-3 ring-offset-0",
        isCancelled && "bg-muted text-muted-foreground line-through opacity-70",
        isDragging && "opacity-50 rotate-1 scale-95 shadow-2xl z-50",
        resizing && "ring-2 ring-primary shadow-2xl"
      )}
    >
      {compact ? (
        <>
          {/* Bloque estrecho: hora de inicio e iniciales; el detalle va en el tooltip */}
          <span className="block text-[10px] font-semibold tabular-nums leading-tight">{formatTime(task.startTime)}</span>
          <span className="block text-[10px] font-bold leading-tight truncate" aria-hidden="true">{initials(displayPropertyName())}</span>
        </>
      ) : (
        <>
          {/* Icono de estado destacado (esquina superior derecha) */}
          <TaskStatusBadge status={displayStatus} className="absolute top-1 right-1 z-20" />

          {/* Header con horas */}
          <div className="flex items-center gap-1 mb-0.5 opacity-80 pr-8">
            <Clock className="w-3 h-3 flex-shrink-0" />
            <span className="text-[10px] font-medium whitespace-nowrap tabular-nums">
              {formatTime(task.startTime)} – {formatTime(displayedEndTime)}
            </span>
          </div>

          {/* Contenido principal */}
          <h3 className="font-bold text-[13px] leading-tight truncate text-left pr-8">
            {displayPropertyName()}
          </h3>

          {clientName && (
            <p className="text-[11px] leading-tight truncate text-left opacity-75 mt-0.5">
              {clientName}
            </p>
          )}

          {/* Subtask badge */}
          <SubtaskBadge task={task} />
        </>
      )}

      {/* Resize overlay durante drag */}
      {resizing && (
        <div className="absolute inset-x-0 bottom-1 z-30 flex justify-center pointer-events-none">
          <span className="px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-[10px] font-bold shadow-md">
            {formatDuration(displayedDurationMin)}
          </span>
        </div>
      )}

      {/* Resize handle (right edge) */}
      {canResize && (
        <div
          onPointerDown={handleResizePointerDown}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "absolute top-0 bottom-0 right-0 w-2 cursor-ew-resize z-30",
            "flex items-center justify-center",
            "opacity-0 hover:opacity-100 transition-opacity",
            resizing && "opacity-100 bg-primary/20"
          )}
          title="Arrastra para cambiar la duración"
          aria-label="Redimensionar tarea"
        >
          <GripVertical className="w-3 h-4 text-foreground/60" />
        </div>
      )}
    </div>
  );

  const tooltipBody = (
    <div className="space-y-1">
      <p className="font-medium">{displayPropertyName()}</p>
      <p className="text-xs text-muted-foreground">
        {formatTime(task.startTime)} - {formatTime(task.endTime)}
      </p>
      <p className="text-xs">
        <TaskStatusBadge status={displayStatus} showLabel />
      </p>
      {isShared && (
        <p className="text-xs">
          Compartida entre {assignedCount} personas · total {formatTime(actionTask.startTime)}–{formatTime(actionTask.endTime)}
        </p>
      )}
      {clientName && <p className="text-xs">{clientName}</p>}
      {task.address && (
        <p className="text-xs">
          <span className="font-medium">Dirección:</span> {task.address}
        </p>
      )}
      {!disableQuickActions && (
        <p className="text-[10px] text-muted-foreground italic mt-1">
          {hasQuickActions
            ? 'Clic derecho o tecla Menú para acciones rápidas'
            : 'Clic derecho o tecla Menú para ver el detalle'}
        </p>
      )}
    </div>
  );

  // If quick actions disabled, return the card with tooltip only (legacy behavior)
  if (disableQuickActions) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{cardElement}</TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">{tooltipBody}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const canMoveOrResize = permissions.canEdit && !isRecurringInstance;
  const canUnassign = permissions.canEdit && (assignedCount > 1 || Boolean(task.cleanerId) || (task.assignments?.length ?? 0) > 0);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="h-full w-full">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>{cardElement}</TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">{tooltipBody}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-60">
        <ContextMenuItem onClick={() => onClick?.(actionTask)}>
          {permissions.canEdit ? <Pencil className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
          {permissions.canEdit ? 'Editar detalles' : 'Ver detalles'}
        </ContextMenuItem>
        {permissions.canEdit && (
          <ContextMenuItem onClick={() => onClick?.(actionTask)}>
            <Users className="mr-2 h-4 w-4" />
            Asignar trabajadoras…
          </ContextMenuItem>
        )}

        {isRecurringInstance && hasQuickActions && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem disabled className="text-xs">
              Ocurrencia recurrente: otras acciones en el detalle
            </ContextMenuItem>
          </>
        )}

        {canMoveOrResize && (
          <>
            <ContextMenuSeparator />
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <CalendarDays className="mr-2 h-4 w-4" />
                Mover a
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuItem onClick={() => moveTaskToDate(task.id, 'previousDay')}>
                  Día anterior ({shortDate(shiftCivilDate(task.date, -1))})
                </ContextMenuItem>
                <ContextMenuItem onClick={() => moveTaskToDate(task.id, 'nextDay')}>
                  Día siguiente ({shortDate(shiftCivilDate(task.date, 1))})
                </ContextMenuItem>
                <ContextMenuItem onClick={() => moveTaskToDate(task.id, 'nextWeek')}>
                  +1 semana ({shortDate(shiftCivilDate(task.date, 7))})
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>

            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <Timer className="mr-2 h-4 w-4" />
                Duración
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {[15, 30, 45, 60, 90, 120].map(min => (
                  <ContextMenuItem key={min} onClick={() => addTaskDuration(task.id, min)}>
                    +{formatDuration(min)}
                  </ContextMenuItem>
                ))}
                <ContextMenuSeparator />
                {[-15, -30, -60].map(min => (
                  <ContextMenuItem key={min} onClick={() => addTaskDuration(task.id, min)}>
                    −{formatDuration(Math.abs(min))}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          </>
        )}

        {permissions.canCreate && !isRecurringInstance && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => dispatchTaskEvent('task:duplicate', { taskId: task.id })}>
              <Copy className="mr-2 h-4 w-4" />
              Duplicar sin asignar
            </ContextMenuItem>
          </>
        )}

        {canUnassign && isShared && rowCleaner && !isRecurringInstance && (
          <ContextMenuItem
            onClick={() => dispatchTaskEvent('task:unassign', { taskId: task.id, cleanerId: rowCleaner.id, cleanerName: rowCleaner.name })}
          >
            <UserMinus className="mr-2 h-4 w-4" />
            Quitar a {rowCleaner.name}
          </ContextMenuItem>
        )}
        {canUnassign && (
          <ContextMenuItem onClick={() => dispatchTaskEvent('task:unassign', { taskId: task.id, all: true })}>
            <UserMinus className="mr-2 h-4 w-4" />
            {isShared ? 'Desasignar a todas' : 'Desasignar'}
          </ContextMenuItem>
        )}
        {permissions.canDelete && !isRecurringInstance && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => dispatchTaskEvent('task:delete', { taskId: task.id })}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
});

EnhancedTaskCard.displayName = "EnhancedTaskCard";
