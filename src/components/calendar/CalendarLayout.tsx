
import { Card, CardContent } from "@/components/ui/card";
import { WorkersColumn } from "./WorkersColumn";
import { TimelineHeader } from "./TimelineHeader";
import { CalendarGrid } from "./CalendarGrid";
import { Task, Cleaner } from "@/types/calendar";

interface CalendarLayoutProps {
  cleaners: Cleaner[];
  timeSlots: string[];
  assignedTasks: Task[];
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
  return (
    <Card className="border-0 shadow-xl overflow-hidden bg-card animate-fade-in">
      <CardContent className="p-0">
        <div className="flex h-[600px] overflow-hidden">
          {/* Workers Column */}
          <WorkersColumn 
            cleaners={cleaners} 
            onDragOver={onDragOver}
            onDrop={onDrop}
          />

          {/* Timeline Area */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Time Header - Scrollable */}
            <TimelineHeader
              ref={headerScrollRef}
              timeSlots={timeSlots}
              onScroll={onHeaderScroll}
            />

            {/* Timeline Body - Scrollable */}
            <CalendarGrid
              ref={bodyScrollRef}
              cleaners={cleaners}
              timeSlots={timeSlots}
              assignedTasks={assignedTasks}
              dragState={dragState}
              onScroll={onBodyScroll}
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
      </CardContent>
    </Card>
  );
};
