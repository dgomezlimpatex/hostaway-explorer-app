
import { cn } from "@/lib/utils";

interface TimeSlotProps {
  hour: number;
  minute: number;
  cleanerId: string;
  isOccupied: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, cleanerId: string, startTime: string) => void;
  children?: React.ReactNode;
}

export const TimeSlot = ({ 
  hour, 
  minute, 
  cleanerId, 
  isOccupied, 
  onDragOver, 
  onDrop,
  children 
}: TimeSlotProps) => {
  const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    onDragOver(e);
    (e.currentTarget as HTMLElement).classList.add('drag-over');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).classList.remove('drag-over');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.remove('drag-over');
    onDrop(e, cleanerId, timeString);
  };

  return (
    <div
      className={cn(
        "relative min-w-[75px] w-[75px] h-20 border-r border-gray-100 transition-colors flex-shrink-0",
        hour % 2 === 0 ? "bg-gray-50" : "bg-white",
        "hover:bg-blue-50 cursor-pointer",
        isOccupied && "cursor-not-allowed"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-time={timeString}
      data-cleaner-id={cleanerId}
    >
      {children}
      
      {/* Drop indicator */}
      <div className="absolute inset-0 border-2 border-dashed border-blue-400 bg-blue-50 opacity-0 transition-opacity duration-200 pointer-events-none drop-indicator" />
    </div>
  );
};
