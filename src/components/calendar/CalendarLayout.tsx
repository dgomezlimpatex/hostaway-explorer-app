
import { Card, CardContent } from "@/components/ui/card";
import { WorkersColumn } from "./WorkersColumn";
import { TimelineHeader } from "./TimelineHeader";
import { CalendarGrid } from "./CalendarGrid";
import { Task, Cleaner } from "@/types/calendar";
import { WorkloadSummary } from "@/types/workload";
import { CleanerAvailability } from "@/hooks/useCleanerAvailability";
import { useDeviceType } from '@/hooks/use-mobile';
import { cn } from "@/lib/utils";
import { WorkerAbsenceStatus } from "@/hooks/useWorkersAbsenceStatus";

interface CalendarLayoutProps {
  cleaners: Cleaner[];
  timeSlots: string[];
  assignedTasks: Task[];
  availability: CleanerAvailability[];
  currentDate: Date;
  dragState: any;
  headerScrollRef: React.RefObject<HTMLDivElement>;
  bodyScrollRef: React.RefObject<HTMLDivElement>;
  onHeaderScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  onBodyScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, cleanerId: string, cleaners: any[], timeSlot?: string) => void;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onTaskClick: (task: Task) => void;
  getTaskPosition: (startTime: string, endTime: string) => { left: string; width: string };
  isTimeSlotOccupied: (cleanerId: string, hour: number, minute: number) => boolean;
  assignmentsMap?: Record<string, string[]>;
  absenceStatus?: Record<string, WorkerAbsenceStatus>;
  isDragging?: boolean;
  preferredCleanerIds?: Set<string>;
  workloadMap?: Record<string, WorkloadSummary>;
}

export const CalendarLayout = ({
  cleaners,
  timeSlots,
  assignedTasks,
  availability,
  currentDate,
  dragState,
  headerScrollRef,
  bodyScrollRef,
  onHeaderScroll,
  onBodyScroll,
  onDragOver,
  onDrop,
  onDragStart,
  onDragEnd,
  onTaskClick,
  getTaskPosition,
  isTimeSlotOccupied,
  assignmentsMap,
  absenceStatus,
  isDragging,
  preferredCleanerIds,
  workloadMap
}: CalendarLayoutProps) => {
  const { isMobile, isTablet } = useDeviceType();

  // Responsive calendar height based on device - fills available viewport space
  const getCalendarHeight = () => {
    if (isMobile) return "h-[calc(100vh-280px)] min-h-[400px]";
    if (isTablet) return "h-[calc(100vh-260px)] min-h-[480px]";
    return "h-[calc(100vh-240px)] min-h-[520px]";
  };

  return (
    <Card className="border-0 shadow-xl overflow-hidden bg-card animate-fade-in flex-1 flex flex-col">
      <CardContent className="p-0 flex-1 flex flex-col">
        <div className={`flex flex-col ${getCalendarHeight()} overflow-hidden`}>
          {/* Headers Row */}
          <div className="flex flex-shrink-0">
            <div className="w-52 h-12 bg-muted/50 border-b border-border flex items-center px-3 border-r border-border flex-shrink-0">
              <span className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">Equipo</span>
            </div>
            {/* Time Header - Sincronizado con el scroll */}
            <div 
              ref={headerScrollRef}
              className="flex-1 h-12 bg-white border-b border-gray-200 overflow-hidden"
            >
              <div className="flex h-full" style={{ minWidth: '1000px' }}>
                {timeSlots.map((time) => (
                  <div 
                    key={time} 
                    className={`min-w-[50px] h-12 flex items-center justify-center text-[11px] font-medium text-gray-600 border-r border-gray-100 ${
                      time.endsWith(':00') ? 'bg-gray-50' : 'bg-white'
                    }`}
                  >
                    {time.endsWith(':00') ? time : ''}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Content Row - Single scroll container for both axes */}
          <div 
            className="flex-1 overflow-auto" 
            ref={bodyScrollRef} 
            onScroll={(e) => {
              // Sync horizontal scroll to header
              if (headerScrollRef.current) {
                headerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
              }
            }}
          >
            <div className="flex" style={{ minWidth: 'max-content' }}>
              {/* Workers Column - Sticky on left so it stays visible during horizontal scroll */}
              <div className="sticky left-0 z-20">
                <WorkersColumn
                  cleaners={cleaners}
                  onDragOver={onDragOver}
                  onDrop={(e, cleanerId, cleanersArr) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const taskId = e.dataTransfer.getData('text/plain');
                    if (taskId) {
                      onDrop(e, cleanerId, cleanersArr);
                    }
                  }}
                  absenceStatus={absenceStatus}
                  isDragging={isDragging}
                  preferredCleanerIds={preferredCleanerIds}
                  workloadMap={workloadMap}
                />
              </div>

              {/* Timeline Area */}
              <CalendarGrid
                cleaners={cleaners}
                timeSlots={timeSlots}
                assignedTasks={assignedTasks}
                availability={availability}
                currentDate={currentDate}
                dragState={dragState}
                onScroll={() => {}}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onTaskClick={onTaskClick}
                getTaskPosition={getTaskPosition}
                isTimeSlotOccupied={isTimeSlotOccupied}
                assignmentsMap={assignmentsMap}
                absenceStatus={absenceStatus}
                isDragging={isDragging}
                preferredCleanerIds={preferredCleanerIds}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
