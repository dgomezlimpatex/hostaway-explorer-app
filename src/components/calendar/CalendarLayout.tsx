
import { Card, CardContent } from "@/components/ui/card";
import { WorkersColumn } from "./WorkersColumn";
import { TimelineHeader } from "./TimelineHeader";
import { CalendarGrid } from "./CalendarGrid";
import { Task, Cleaner } from "@/types/calendar";
import { CleanerAvailability } from "@/hooks/useCleanerAvailability";
import { useDeviceType } from '@/hooks/use-mobile';
import { cn } from "@/lib/utils";

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
  isTimeSlotOccupied
}: CalendarLayoutProps) => {
  const { isMobile, isTablet } = useDeviceType();

  // Responsive calendar height based on device
  const getCalendarHeight = () => {
    if (isMobile) return "h-[400px] md:h-[500px]";
    if (isTablet) return "h-[500px] md:h-[600px]";
    return "h-[600px]";
  };

  return (
    <Card className="border-0 shadow-xl overflow-hidden bg-card animate-fade-in">
      <CardContent className="p-0">
        <div className={`flex flex-col ${getCalendarHeight()} overflow-hidden`}>
          {/* Headers Row */}
          <div className="flex flex-shrink-0">
            <div className="w-48 h-16 bg-white border-b border-gray-200 flex items-center px-4 border-r border-gray-200">
              <span className="font-semibold text-gray-700">Trabajadores</span>
            </div>
            {/* Time Header - Sincronizado con el scroll */}
            <div 
              ref={headerScrollRef}
              className="flex-1 h-16 bg-white border-b border-gray-200 overflow-hidden"
            >
              <div className="flex h-full" style={{ minWidth: '1200px' }}>
                {timeSlots.map((time) => (
                  <div 
                    key={time} 
                    className={`min-w-[60px] h-16 flex items-center justify-center text-xs font-medium text-gray-600 border-r border-gray-100 ${
                      time.endsWith(':00') ? 'bg-gray-50' : 'bg-white'
                    }`}
                  >
                    {time.endsWith(':00') ? time : ''}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Content Row - Con scroll horizontal sincronizado */}
          <div className="flex flex-1 overflow-hidden">
            {/* Workers Column - Fija a la izquierda */}
            <div className="w-48 bg-gray-50 border-r border-gray-200 flex-shrink-0">
              <div>
                {cleaners.map((cleaner, index) => (
                  <div 
                    key={cleaner.id} 
                    className={cn(
                      "h-20 border-b-2 border-gray-300 p-3 flex items-center hover:bg-gray-100 transition-colors cursor-pointer",
                      index % 2 === 0 ? "bg-white" : "bg-gray-50"
                    )}
                    onDragOver={onDragOver}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const taskId = e.dataTransfer.getData('text/plain');
                      if (taskId) {
                        onDrop(e, cleaner.id, cleaners);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                        {cleaner.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 text-sm">{cleaner.name}</div>
                        <div className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${cleaner.isActive ? 'bg-green-400' : 'bg-gray-400'}`} />
                          <span className="text-xs text-gray-500">
                            {cleaner.isActive ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline Area - Solo el calendario sin header duplicado */}
            <div className="flex-1 min-w-0 overflow-x-auto" onScroll={onBodyScroll}>
              <CalendarGrid
                ref={bodyScrollRef}
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
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
