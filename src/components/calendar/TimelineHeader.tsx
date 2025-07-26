
import { forwardRef } from "react";

interface TimelineHeaderProps {
  timeSlots: string[];
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
}

export const TimelineHeader = forwardRef<HTMLDivElement, TimelineHeaderProps>(
  ({ timeSlots, onScroll }, ref) => {
    return (
      <div 
        ref={ref}
        className="h-16 bg-white border-b border-gray-200 overflow-hidden"
        onScroll={onScroll}
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
    );
  }
);

TimelineHeader.displayName = "TimelineHeader";
