
import { Cleaner } from "@/types/calendar";
import { cn } from "@/lib/utils";
import { WorkerAbsenceStatus } from "@/hooks/useWorkersAbsenceStatus";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ABSENCE_TYPE_LABELS } from "@/types/workerAbsence";
import { Star } from "lucide-react";
import { WorkloadSummary, getProgressBarColor } from "@/types/workload";
import { Progress } from "@/components/ui/progress";

interface WorkersColumnProps {
  cleaners: Cleaner[];
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, cleanerId: string, cleaners: Cleaner[]) => void;
  absenceStatus?: Record<string, WorkerAbsenceStatus>;
  isDragging?: boolean;
  preferredCleanerIds?: Set<string>;
  workloadMap?: Record<string, WorkloadSummary>;
}

export const WorkersColumn = ({ cleaners, onDragOver, onDrop, absenceStatus, isDragging, preferredCleanerIds, workloadMap }: WorkersColumnProps) => {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    onDragOver(e);
    const target = e.currentTarget as HTMLElement;
    target.classList.add('bg-line-soft');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.classList.remove('bg-line-soft');
  };

  const handleDrop = (e: React.DragEvent, cleanerId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.classList.remove('bg-line-soft');
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      onDrop(e, cleanerId, cleaners);
    }
  };

  const getAbsenceLabel = (status: WorkerAbsenceStatus | undefined) => {
    if (status?.isFixedDayOff) return 'Día libre fijo';
    if (status?.absenceType) {
      return ABSENCE_TYPE_LABELS[status.absenceType as keyof typeof ABSENCE_TYPE_LABELS] || status.absenceType;
    }
    return '';
  };

  // Convert hex to rgba for proper opacity
  const getAbsenceBgColor = (hexColor: string) => {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, 0.15)`;
  };

  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 flex-shrink-0 overflow-hidden">
      {cleaners.map((cleaner, index) => {
        const status = absenceStatus?.[cleaner.id];
        const isAbsent = status?.isAbsent;
        const hasMaintenance = status?.maintenanceCleanings?.some(m => m.scheduleType !== 'unavailability');
        const hasUnavailability = status?.maintenanceCleanings?.some(m => m.scheduleType === 'unavailability');
        const hasHourlyAbsence = status?.hourlyAbsences && status.hourlyAbsences.length > 0;
        const isPreferred = isDragging && preferredCleanerIds && preferredCleanerIds.has(cleaner.id);
        const isDimmed = isDragging && preferredCleanerIds && preferredCleanerIds.size > 0 && !preferredCleanerIds.has(cleaner.id);
        const workload = workloadMap?.[cleaner.id];

        return (
          <div 
            key={cleaner.id} 
            className={cn(
              "h-16 border-b border-gray-200 px-3 py-1.5 flex items-center transition-all duration-200 cursor-pointer relative",
              !isAbsent && !isPreferred && !isDimmed && (index % 2 === 0 ? "bg-white hover:bg-gray-100" : "bg-gray-50 hover:bg-gray-100"),
              isPreferred && "bg-surface ring-2 ring-warning ring-inset shadow-inner",
              isDimmed && "opacity-40"
            )}
            style={isAbsent ? { 
              backgroundColor: getAbsenceBgColor(status?.absenceColor || '#6B7280'),
              borderLeftWidth: '4px',
              borderLeftColor: status?.absenceColor || '#6B7280',
              borderLeftStyle: 'solid'
            } : undefined}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, cleaner.id)}
          >
            {/* Línea de color personal de la trabajadora */}
            <span
              className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full"
              style={{ backgroundColor: isAbsent ? (status?.absenceColor || '#6B7280') : `hsl(${(cleaner.name.charCodeAt(0) * 37) % 360}, 65%, 55%)` }}
              aria-hidden
            />
            <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden pl-1">
              <div className="relative flex-shrink-0">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-xs shadow-sm ring-2 ring-white"
                  style={{ backgroundColor: `hsl(${(cleaner.name.charCodeAt(0) * 37) % 360}, 60%, 50%)` }}
                >
                  {cleaner.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                {(isAbsent || hasMaintenance || hasHourlyAbsence || hasUnavailability) && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div 
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center cursor-help"
                          style={{ 
                            backgroundColor: isAbsent 
                              ? (status?.absenceColor || '#6B7280')
                              : hasMaintenance 
                                ? '#EAB308' 
                                : '#8B5CF6'
                          }}
                        >
                          {hasMaintenance && !isAbsent && (
                            <span className="text-[8px] text-white font-bold">M</span>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <div className="text-xs space-y-1">
                          {isAbsent && (
                            <div className="font-medium">{getAbsenceLabel(status)}</div>
                          )}
                          {status?.maintenanceCleanings?.map((m, i) => (
                            <div key={i} className="text-muted-foreground">
                              {m.scheduleType === 'unavailability' ? '⛔ No disponible' : `🧹 ${m.locationName}`} ({m.startTime.slice(0,5)} - {m.endTime.slice(0,5)})
                            </div>
                          ))}
                          {hasHourlyAbsence && status?.hourlyAbsences?.map((h, i) => (
                            <div key={i} className="text-muted-foreground">
                              ⏰ {ABSENCE_TYPE_LABELS[h.type as keyof typeof ABSENCE_TYPE_LABELS]} ({h.startTime.slice(0,5)} - {h.endTime.slice(0,5)})
                            </div>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="font-semibold text-gray-900 text-[13px] flex items-center gap-1 min-w-0 leading-tight">
                  {isPreferred && <Star className="h-3 w-3 shrink-0 fill-warning text-warning" />}
                  <span className="truncate">{cleaner.name}</span>
                </div>
                {isAbsent ? (
                  <span 
                    className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded mt-0.5"
                    style={{ 
                      backgroundColor: `${status?.absenceColor || '#6B7280'}20`,
                      color: status?.absenceColor || '#6B7280'
                    }}
                  >
                    {getAbsenceLabel(status)}
                  </span>
                ) : workload ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="mt-1 flex items-center gap-2">
                          {workload.contractHoursPerWeek > 0 ? (
                            <>
                              <Progress 
                                value={Math.min(workload.percentageComplete, 100)} 
                                className="h-2 flex-1 bg-gray-200"
                                indicatorClassName={getProgressBarColor(workload.status)}
                              />
                              <span className="text-xs text-gray-700 whitespace-nowrap font-bold tabular-nums">
                                {workload.totalWorked.toFixed(1)} / {workload.contractHoursPerWeek} h
                              </span>
                            </>
                          ) : (
                            <span className="rounded-md bg-line-soft px-1.5 py-0.5 text-xs font-semibold text-ink-3">
                              {workload.totalWorked.toFixed(1)} h · Sin contrato
                            </span>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <div className="text-xs space-y-1 p-1">
                          <div className="font-semibold mb-1">Carga semanal</div>
                          <div className="flex justify-between gap-4">
                            <span>🏖️ Turísticas:</span>
                            <span className="font-medium">{workload.touristHours.toFixed(1)}h ({workload.touristTaskCount} tareas)</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span>🧹 Mantenimiento:</span>
                            <span className="font-medium">{workload.maintenanceHours.toFixed(1)}h</span>
                          </div>
                          {workload.recurringHours > 0 && (
                            <div className="flex justify-between gap-4">
                              <span>🔄 Recurrentes:</span>
                              <span className="font-medium">{workload.recurringHours.toFixed(1)}h ({workload.recurringTaskCount} tareas)</span>
                            </div>
                          )}
                          {workload.adjustmentHours !== 0 && (
                            <div className="flex justify-between gap-4">
                              <span>📝 Ajustes:</span>
                              <span className="font-medium">{workload.adjustmentHours > 0 ? '+' : ''}{workload.adjustmentHours.toFixed(1)}h</span>
                            </div>
                          )}
                          <div className="border-t border-gray-200 pt-1 mt-1 flex justify-between gap-4 font-semibold">
                            <span>Total:</span>
                            <span>{workload.totalWorked.toFixed(1)}h / {workload.contractHoursPerWeek}h</span>
                          </div>
                          {workload.overtimeHours > 0 && (
                            <div className="text-warning font-medium">⚠️ Horas extra: +{workload.overtimeHours.toFixed(1)}h</div>
                          )}
                          {workload.remainingHours > 0 && workload.status !== 'on-track' && (
                            <div className="text-ink-3 font-medium">📊 Faltan: {workload.remainingHours.toFixed(1)}h</div>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${cleaner.isActive ? 'bg-success' : 'bg-gray-400'}`} />
                    <span className="text-[10px] text-gray-500">
                      {cleaner.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
