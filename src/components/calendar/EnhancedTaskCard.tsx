import React, { useCallback, useEffect, useRef, useState } from "react";
import { Task } from "@/types/calendar";
import { Clock, ListTodo, Hourglass, Play, Check, X, GripHorizontal, Pencil, Copy, Trash2, UserMinus, CalendarDays, Timer } from "lucide-react";
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

// Subtask badge component
const SubtaskBadge = ({ task }: { task: Task }) => {
  const additionalTasks = task.additionalTasks || [];
  if (additionalTasks.length === 0) return null;

  const pendingCount = additionalTasks.filter(t => !t.completed).length;
  const allCompleted = pendingCount === 0;

  return (
    <div
      className={cn(
        "absolute top-1 right-7 z-20 flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[9px] font-bold shadow-sm",
        allCompleted
          ? "bg-emerald-500 text-white"
          : "bg-rose-500 text-white animate-pulse"
      )}
    >
      <ListTodo className="h-2.5 w-2.5" />
      <span>{pendingCount > 0 ? pendingCount : additionalTasks.length}</span>
    </div>
  );
};

interface EnhancedTaskCardProps {
  task: Task;
  onClick?: () => void;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent, task: Task) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  style?: React.CSSProperties;
  /** Disable resize handle and context menu (e.g. unassigned panel). Defaults to false. */
  disableQuickActions?: boolean;
}

// 30-min slot column = 50px (matches TimeSlot.tsx). 15min = 25px.
const PIXELS_PER_MINUTE = 50 / 30;

const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const fromMinutes = (mins: number) => {
  const clamped = Math.max(0, Math.min(mins, 24 * 60 - 1));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const snapToQuarter = (mins: number) => Math.round(mins / 15) * 15;

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
  disableQuickActions
}: EnhancedTaskCardProps) => {
  const { getClientName } = useClientData();
  const clientColor = getClientColor(task.clienteId);
  const { resizeTask, moveTaskToDate, addTaskDuration } = useTaskQuickActions();

  // Resize state
  const [resizing, setResizing] = useState(false);
  const [previewEndTime, setPreviewEndTime] = useState<string | null>(null);
  const resizeStartY = useRef(0);
  const initialEndMin = useRef(0);
  const startMinRef = useRef(0);

  // Estados especiales que sobrescriben el color del cliente para ser legibles
  const isCompleted = task.status === 'completed';
  const isInProgress = task.status === 'in-progress';
  const isCancelled = (task.status as string) === 'cancelled';
  const isPending = task.status === 'pending';

  // Configuración del icono de estado
  const statusConfig = isCompleted
    ? { Icon: Check, bg: 'bg-emerald-500', label: 'Completada' }
    : isInProgress
    ? { Icon: Play, bg: 'bg-blue-500', label: 'En progreso' }
    : isCancelled
    ? { Icon: X, bg: 'bg-gray-500', label: 'Cancelada' }
    : { Icon: Hourglass, bg: 'bg-orange-500', label: 'Pendiente' };
  const StatusIcon = statusConfig.Icon;

  const formatTime = (time: string) => {
    if (time.includes(':')) {
      const parts = time.split(':');
      return `${parts[0]}:${parts[1]}`;
    }
    return time;
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (resizing) {
      e.preventDefault();
      return;
    }
    if (onDragStart) {
      onDragStart(e, task);
    }
  };

  // ---------- Resize logic ----------
  const handleResizePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    resizeStartY.current = e.clientY;
    startMinRef.current = toMinutes(task.startTime);
    initialEndMin.current = toMinutes(task.endTime);
    setResizing(true);
    setPreviewEndTime(task.endTime);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [task.startTime, task.endTime]);

  useEffect(() => {
    if (!resizing) return;

    const handleMove = (e: PointerEvent) => {
      const deltaY = e.clientY - resizeStartY.current;
      const deltaMin = deltaY / PIXELS_PER_MINUTE;
      const rawEndMin = initialEndMin.current + deltaMin;
      const snapped = snapToQuarter(rawEndMin);
      const safeEnd = Math.max(startMinRef.current + 15, snapped);
      setPreviewEndTime(fromMinutes(safeEnd));
    };

    const handleUp = () => {
      setResizing(false);
      const finalEnd = previewEndTime;
      setPreviewEndTime(null);
      if (finalEnd && finalEnd !== task.endTime) {
        resizeTask(task.id, finalEnd);
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [resizing, previewEndTime, task.id, task.endTime, resizeTask]);

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

  // If resizing, we override the visual height to match the preview
  if (resizing && previewEndTime) {
    const newHeightPx = (toMinutes(previewEndTime) - toMinutes(task.startTime)) * PIXELS_PER_MINUTE;
    cardStyle.height = `${Math.max(newHeightPx, 16)}px`;
  }

  const cardElement = (
    <div
      draggable={!resizing}
      onClick={resizing ? undefined : onClick}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      style={cardStyle}
      className={cn(
        "relative px-2 py-1.5 rounded-lg border-l-[5px] cursor-pointer transition-all duration-200",
        "hover:shadow-md",
        !resizing && "hover:-translate-y-0.5",
        "focus:outline-none focus:ring-2 focus:ring-primary/40",
        "transform-gpu overflow-hidden",
        isCompleted && "ring-2 ring-emerald-400/60 ring-offset-0",
        isInProgress && "ring-2 ring-blue-400/70 ring-offset-0 animate-pulse",
        isCancelled && "bg-muted text-muted-foreground line-through opacity-70",
        isDragging && "opacity-50 rotate-1 scale-95 shadow-2xl z-50",
        resizing && "ring-2 ring-primary shadow-2xl"
      )}
    >
      {/* Icono de estado destacado (esquina superior derecha) */}
      <div
        className={cn(
          "absolute top-1 right-1 z-20 flex items-center justify-center w-5 h-5 rounded-full shadow-md ring-2 ring-white",
          statusConfig.bg,
          isPending && "animate-pulse"
        )}
        aria-label={statusConfig.label}
      >
        <StatusIcon className="w-3 h-3 text-white" strokeWidth={3} />
      </div>

      {/* Header con horas */}
      <div className="flex items-center gap-1 mb-0.5 opacity-80 pr-6">
        <Clock className="w-3 h-3 flex-shrink-0" />
        <span className="text-[10px] font-medium whitespace-nowrap tabular-nums">
          {formatTime(task.startTime)} – {formatTime(displayedEndTime)}
        </span>
      </div>

      {/* Contenido principal */}
      <h3 className="font-bold text-[13px] leading-tight truncate text-left">
        {displayPropertyName()}
      </h3>

      {clientName && (
        <p className="text-[11px] leading-tight truncate text-left opacity-75 mt-0.5">
          {clientName}
        </p>
      )}

      {/* Subtask badge */}
      <SubtaskBadge task={task} />

      {/* Resize overlay durante drag */}
      {resizing && (
        <div className="absolute inset-x-0 bottom-1 z-30 flex justify-center pointer-events-none">
          <span className="px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-[10px] font-bold shadow-md">
            {formatDuration(displayedDurationMin)}
          </span>
        </div>
      )}

      {/* Resize handle (bottom edge) */}
      {!disableQuickActions && !isCancelled && (
        <div
          onPointerDown={handleResizePointerDown}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize z-30",
            "flex items-center justify-center",
            "opacity-0 hover:opacity-100 transition-opacity",
            resizing && "opacity-100 bg-primary/20"
          )}
          title="Arrastra para cambiar la duración"
          aria-label="Redimensionar tarea"
        >
          <GripHorizontal className="w-4 h-3 text-foreground/60" />
        </div>
      )}
    </div>
  );

  // If quick actions disabled, return the card with tooltip only (legacy behavior)
  if (disableQuickActions) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{cardElement}</TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-medium">{displayPropertyName()}</p>
              <p className="text-xs text-muted-foreground">
                {formatTime(task.startTime)} - {formatTime(task.endTime)}
              </p>
              <p className="text-xs">
                <span className="font-medium">Estado:</span> {statusConfig.label}
              </p>
              {clientName && <p className="text-xs">{clientName}</p>}
              {task.address && (
                <p className="text-xs">
                  <span className="font-medium">Dirección:</span> {task.address}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="h-full w-full">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>{cardElement}</TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="space-y-1">
                  <p className="font-medium">{displayPropertyName()}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatTime(task.startTime)} - {formatTime(task.endTime)}
                  </p>
                  <p className="text-xs">
                    <span className="font-medium">Estado:</span> {statusConfig.label}
                  </p>
                  {clientName && <p className="text-xs">{clientName}</p>}
                  {task.address && (
                    <p className="text-xs">
                      <span className="font-medium">Dirección:</span> {task.address}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground italic mt-1">
                    Clic derecho para acciones rápidas
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={() => onClick?.()}>
          <Pencil className="mr-2 h-4 w-4" />
          Editar detalles
        </ContextMenuItem>
        <ContextMenuSeparator />

        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <CalendarDays className="mr-2 h-4 w-4" />
            Mover a
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onClick={() => moveTaskToDate(task.id, 'today')}>
              Hoy
            </ContextMenuItem>
            <ContextMenuItem onClick={() => moveTaskToDate(task.id, 'tomorrow')}>
              Mañana
            </ContextMenuItem>
            <ContextMenuItem onClick={() => moveTaskToDate(task.id, 'nextWeek')}>
              +1 semana
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

        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => {
            const ev = new CustomEvent('task:duplicate', { detail: { taskId: task.id } });
            window.dispatchEvent(ev);
          }}
        >
          <Copy className="mr-2 h-4 w-4" />
          Duplicar tarea
        </ContextMenuItem>
        {task.cleanerId && (
          <ContextMenuItem
            onClick={() => {
              const ev = new CustomEvent('task:unassign', { detail: { taskId: task.id } });
              window.dispatchEvent(ev);
            }}
          >
            <UserMinus className="mr-2 h-4 w-4" />
            Desasignar
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => {
            const ev = new CustomEvent('task:delete', { detail: { taskId: task.id } });
            window.dispatchEvent(ev);
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Eliminar
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});

EnhancedTaskCard.displayName = "EnhancedTaskCard";
