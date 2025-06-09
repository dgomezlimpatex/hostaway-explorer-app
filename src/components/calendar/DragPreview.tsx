
import { Task } from "@/hooks/useCalendarData";
import { TaskCard } from "./TaskCard";
import { useEffect, useState } from "react";

interface DragPreviewProps {
  task: Task;
  isDragging: boolean;
  offset: { x: number; y: number };
}

export const DragPreview = ({ task, isDragging, offset }: DragPreviewProps) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - offset.x,
        y: e.clientY - offset.y
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [isDragging, offset]);

  if (!isDragging) return null;

  return (
    <div
      className="fixed z-50 pointer-events-none transform rotate-3 scale-105"
      style={{
        left: position.x,
        top: position.y,
        transform: 'rotate(3deg) scale(1.05)'
      }}
    >
      <div className="shadow-2xl">
        <TaskCard 
          task={task} 
          isDragging={true}
          style={{ opacity: 0.9 }}
        />
      </div>
    </div>
  );
};
