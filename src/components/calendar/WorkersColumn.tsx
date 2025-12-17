
import { Cleaner } from "@/types/calendar";
import { cn } from "@/lib/utils";
import { WorkerAbsenceStatus } from "@/hooks/useWorkersAbsenceStatus";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ABSENCE_TYPE_LABELS } from "@/types/workerAbsence";

interface WorkersColumnProps {
  cleaners: Cleaner[];
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, cleanerId: string, cleaners: any[]) => void;
  absenceStatus?: Record<string, WorkerAbsenceStatus>;
}

export const WorkersColumn = ({ cleaners, onDragOver, onDrop, absenceStatus }: WorkersColumnProps) => {
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

  return (
    <div className="w-48 bg-gray-50 border-r border-gray-200 flex-shrink-0 flex flex-col">
      {/* Header */}
      <div className="h-16 bg-white border-b border-gray-200 flex items-center px-4 flex-shrink-0">
        <span className="font-semibold text-gray-700">Trabajadores</span>
      </div>
      
      {/* Workers List */}
      <div className="flex-1">
        {cleaners.map((cleaner, index) => {
          const status = absenceStatus?.[cleaner.id];
          const isAbsent = status?.isAbsent;
          const hasMaintenance = status?.maintenanceCleanings && status.maintenanceCleanings.length > 0;
          const hasHourlyAbsence = status?.hourlyAbsences && status.hourlyAbsences.length > 0;

          return (
            <div 
              key={cleaner.id} 
              className={cn(
                "h-20 border-b-2 border-gray-300 p-3 flex items-center hover:bg-gray-100 transition-colors cursor-pointer relative",
                index % 2 === 0 ? "bg-white" : "bg-gray-50",
                isAbsent && "opacity-60"
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, cleaner.id)}
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                    {cleaner.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </div>
                  {/* Absence indicator dot */}
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
                  <div className="font-medium text-gray-900 text-sm truncate">{cleaner.name}</div>
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
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
