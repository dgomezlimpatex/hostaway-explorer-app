
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { WorkersColumn } from "./WorkersColumn";
import { TimelineHeader } from "./TimelineHeader";
import { CalendarGrid } from "./CalendarGrid";
import { Task, Cleaner } from "@/types/calendar";
import type { DragState } from "@/hooks/useDragAndDrop";
import { WorkloadSummary } from "@/types/workload";
import { CleanerAvailability } from "@/hooks/useCleanerAvailability";
import { useDeviceType } from '@/hooks/use-mobile';
import { cn } from "@/lib/utils";
import { WorkerAbsenceStatus } from "@/hooks/useWorkersAbsenceStatus";
import { formatMadridDate } from "@/utils/date";
import { getMadridToday } from "@/utils/madridCalendar";
import { DEFAULT_SCALE, getInitialScrollLeft, timeToMinutes, timelineWidthPx, type TimelineScale } from "./utils/timelineScale";

// Minutes since 00:00 in Europe/Madrid, whatever the device timezone.
const getMadridNowMinutes = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  return get('hour') * 60 + get('minute');
};

interface CalendarLayoutProps {
  cleaners: Cleaner[];
  timeSlots: string[];
  assignedTasks: Task[];
  availability: CleanerAvailability[];
  currentDate: Date;
  dragState: DragState;
  headerScrollRef: React.RefObject<HTMLDivElement>;
  bodyScrollRef: React.RefObject<HTMLDivElement>;
  onHeaderScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  onBodyScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, cleanerId: string, cleaners: Cleaner[], timeSlot?: string) => void;
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
  /** Visible range and column width (zoom). */
  scale?: TimelineScale;
  onBlockedDrop?: (reason: string) => void;
  /** Cleaners without availability configured for the day shown. */
  unconfiguredCleanerIds?: Set<string>;
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
  workloadMap,
  scale = DEFAULT_SCALE,
  onBlockedDrop,
  unconfiguredCleanerIds
}: CalendarLayoutProps) => {
  const { isMobile, isTablet } = useDeviceType();
  const dayStr = formatMadridDate(currentDate);
  const isToday = dayStr === getMadridToday();

  // "Now" line, refreshed every minute while today is shown.
  const [nowMinutes, setNowMinutes] = useState<number | null>(() => (isToday ? getMadridNowMinutes() : null));
  useEffect(() => {
    if (!isToday) {
      setNowMinutes(null);
      return;
    }
    setNowMinutes(getMadridNowMinutes());
    const timer = window.setInterval(() => setNowMinutes(getMadridNowMinutes()), 60_000);
    return () => window.clearInterval(timer);
  }, [isToday]);

  // When the day (or zoom) changes, open on the current time for today, or
  // on the first task of the day; never stay stuck at the left edge.
  const firstTaskStart = assignedTasks
    .filter((task) => task.date === dayStr)
    .reduce<number | null>((min, task) => {
      const start = timeToMinutes(task.startTime);
      return min === null || start < min ? start : min;
    }, null);
  useEffect(() => {
    const body = bodyScrollRef.current;
    if (!body) return;
    const target = isToday ? getMadridNowMinutes() : firstTaskStart;
    if (target === null) return;
    body.scrollLeft = getInitialScrollLeft(target, scale);
    if (headerScrollRef.current) headerScrollRef.current.scrollLeft = body.scrollLeft;
    // Only on day/zoom changes: later refetches keep the person's scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayStr, scale.slotWidth, scale.startMinutes]);

  return (
    <Card className="border-0 shadow-xl overflow-hidden bg-card animate-fade-in flex-1 flex flex-col min-h-0">
      <CardContent className="p-0 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Headers Row */}
          <div className="flex flex-shrink-0">
            <div className="w-64 h-12 bg-muted/50 border-b border-border flex items-center px-3 border-r border-border flex-shrink-0">
              <span className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">Equipo</span>
            </div>
            {/* Time Header - Sincronizado con el scroll */}
            <div 
              ref={headerScrollRef}
              className="flex-1 h-12 bg-white border-b border-gray-200 overflow-hidden"
            >
              <div className="flex h-full" style={{ minWidth: `${timelineWidthPx(scale)}px` }}>
                {timeSlots.map((time) => (
                  <div
                    key={time}
                    style={{ width: scale.slotWidth, minWidth: scale.slotWidth }}
                    className={`h-12 flex-shrink-0 flex items-center justify-center text-[11px] font-medium text-gray-600 border-r border-gray-100 ${
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
                  onDrop={onDrop}
                  absenceStatus={absenceStatus}
                  isDragging={isDragging}
                  preferredCleanerIds={preferredCleanerIds}
                  workloadMap={workloadMap}
                  unconfiguredCleanerIds={unconfiguredCleanerIds}
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
                scale={scale}
                nowMinutes={nowMinutes}
                onBlockedDrop={onBlockedDrop}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
