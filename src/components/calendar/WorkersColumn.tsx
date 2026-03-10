
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
  onDrop: (e: React.DragEvent, cleanerId: string, cleaners: any[]) => void;
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
    target.classList.add('bg-blue-100');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.classList.remove('bg-blue-100');
  };

  const handleDrop = (e: React.DragEvent, cleanerId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.classList.remove('bg-blue-100');
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
        const hasMaintenance = status?.maintenanceCleanings && status.maintenanceCleanings.length > 0;
        const hasHourlyAbsence = status?.hourlyAbsences && status.hourlyAbsences.length > 0;
        const isPreferred = isDragging && preferredCleanerIds && preferredCleanerIds.has(cleaner.id);
        const isDimmed = isDragging && preferredCleanerIds && preferredCleanerIds.size > 0 && !preferredCleanerIds.has(cleaner.id);
        const workload = workloadMap?.[cleaner.id];

        return (
          <div 
            key={cleaner.id} 
            className={cn(
              "h-24 border-b-2 border-gray-300 p-3 flex items-center transition-all duration-200 cursor-pointer relative",
              !isAbsent && !isPreferred && !isDimmed && (index % 2 === 0 ? "bg-white hover:bg-gray-100" : "bg-gray-50 hover:bg-gray-100"),
              isPreferred && "bg-yellow-50 ring-2 ring-yellow-400 ring-inset shadow-inner",
              isDimmed && "opacity-40"
            )}
            style={isAbsent ? { 
              backgroundColor: getAbsenceBgColor(status?.absenceColor || '#6B7280'),
              borderLeftWidth: '5px',
              borderLeftColor: status?.absenceColor || '#6B7280',
              borderLeftStyle: 'solid'
            } : undefined}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, cleaner.id)}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                  {cleaner.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </div>
                {(isAbsent || hasMaintenance || hasHourlyAbsence) && (
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
                          {hasMaintenance && status?.maintenanceCleanings?.map((m, i) => (
                            <div key={i} className="text-muted-foreground">
                              🧹 {m.locationName} ({m.startTime.slice(0,5)} - {m.endTime.slice(0,5)})
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
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-900 text-sm flex items-center gap-1 min-w-0">
                  {isPreferred && <Star className="h-3 w-3 text-yellow-500 flex-shrink-0 fill-yellow-500" />}
                  <span className="truncate">{cleaner.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  {isAbsent ? (
                    <span 
                      className="text-xs font-medium px-1.5 py-0.5 rounded"
                      style={{ 
                        backgroundColor: `${status?.absenceColor || '#6B7280'}20`,
                        color: status?.absenceColor || '#6B7280'
                      }}
                    >
                      {getAbsenceLabel(status)}
                    </span>
                  ) : (
                    <>
                      <div className={`w-2 h-2 rounded-full ${cleaner.isActive ? 'bg-green-400' : 'bg-gray-400'}`} />
                      <span className="text-xs text-gray-500">
                        {cleaner.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </>
                  )}
                </div>
                {/* Workload mini progress bar */}
                {workload && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1.5 mt-1">
                          {workload.contractHoursPerWeek > 0 ? (
                            <>
                              <Progress 
                                value={Math.min(workload.percentageComplete, 100)} 
                                className="h-1.5 flex-1 bg-gray-200"
                                indicatorClassName={getProgressBarColor(workload.status)}
                              />
                              <span className="text-[10px] text-gray-500 whitespace-nowrap font-medium">
                                {workload.totalWorked.toFixed(1)}/{workload.contractHoursPerWeek}h
                              </span>
                            </>
                          ) : (
                            <span className="text-[10px] text-gray-400">
                              {workload.totalWorked.toFixed(1)}h (sin contrato)
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
                            <div className="text-amber-600 font-medium">⚠️ Horas extra: +{workload.overtimeHours.toFixed(1)}h</div>
                          )}
                          {workload.remainingHours > 0 && workload.status !== 'on-track' && (
                            <div className="text-blue-600 font-medium">📊 Faltan: {workload.remainingHours.toFixed(1)}h</div>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
