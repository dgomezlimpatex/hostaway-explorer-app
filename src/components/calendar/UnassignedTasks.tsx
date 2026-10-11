
import { Card, CardContent } from "@/components/ui/card";
import { TaskCard } from "./TaskCard";
import { Task } from "@/types/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { civilDateToLocalDate } from "./utils/multiDayCalendar";

interface UnassignedTasksProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onDragEnd: (e: React.DragEvent) => void;
}

export const UnassignedTasks = ({
  tasks,
  onTaskClick,
  onDragStart,
  onDragEnd
}: UnassignedTasksProps) => {
  if (tasks.length === 0) return null;

  // Sort by date (multi-day views) and then alphabetically by property name
  const sortedTasks = [...tasks].sort((a, b) =>
    a.date.localeCompare(b.date) ||
    a.property.localeCompare(b.property, 'es', { sensitivity: 'base' })
  );
  const showDateHeaders = new Set(tasks.map(task => task.date)).size > 1;

  const handleTaskDragStart = (e: React.DragEvent, task: Task) => {
    // Store task data in multiple formats for compatibility
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.setData('application/json', JSON.stringify(task));
    e.dataTransfer.effectAllowed = 'move';
    onDragStart(e, task);
  };

  const handleTaskDragEnd = (e: React.DragEvent) => {
    onDragEnd(e);
  };

  return (
    <Card className="border border-line shadow-lg h-full py-[15px] rounded-md bg-white">
      <CardContent className="p-4 h-full flex flex-col my-0 py-[4px] mx-0 px-[8px]">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 flex-shrink-0">
          📋 Tareas Sin Asignar 
          <span className="bg-line-soft text-warning text-xs px-2 py-1 rounded-full">
            {tasks.length}
          </span>
        </h3>
        <div className="flex-1 overflow-y-auto space-y-3">
          {sortedTasks.map((task, index) => (
            <div key={task.id} className="space-y-2">
            {showDateHeaders && task.date !== sortedTasks[index - 1]?.date && (
              <div className="pt-1 text-xs font-semibold capitalize text-muted-foreground">
                {format(civilDateToLocalDate(task.date), "EEEE d 'de' MMMM", { locale: es })}
              </div>
            )}
            <TaskCard 
              key={task.id} 
              task={task} 
              onClick={() => onTaskClick(task)} 
              onDragStart={e => handleTaskDragStart(e, task)} 
              onDragEnd={handleTaskDragEnd} 
              draggable={true} 
            />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
