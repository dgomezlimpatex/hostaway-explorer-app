import { Card, CardContent } from "@/components/ui/card";
import { TaskCard } from "./TaskCard";
import { Task } from "@/types/calendar";
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
  const handleTaskDragStart = (e: React.DragEvent, task: Task) => {
    console.log('UnassignedTasks - handleTaskDragStart:', task.id);
    // Store task data in multiple formats for compatibility
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.setData('application/json', JSON.stringify(task));
    e.dataTransfer.effectAllowed = 'move';
    onDragStart(e, task);
  };
  const handleTaskDragEnd = (e: React.DragEvent) => {
    console.log('UnassignedTasks - handleTaskDragEnd');
    onDragEnd(e);
  };
  return <Card className="border border-orange-200 shadow-lg h-full py-[15px] rounded-xl bg-white">
      <CardContent className="p-4 h-full flex flex-col my-0 py-[4px] mx-0 px-[8px]">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 flex-shrink-0">
          📋 Tareas Sin Asignar 
          <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">
            {tasks.length}
          </span>
        </h3>
        <div className="flex-1 overflow-y-auto space-y-3">
          {tasks.map(task => <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} onDragStart={e => handleTaskDragStart(e, task)} onDragEnd={handleTaskDragEnd} draggable={true} />)}
        </div>
      </CardContent>
    </Card>;
};