
import { Card, CardContent } from "@/components/ui/card";
import { useState, useMemo, useRef } from "react";
import { useCalendarData } from "@/hooks/useCalendarData";
import { ResponsiveCalendarHeader } from "./calendar/ResponsiveCalendarHeader";
import { WorkersColumn } from "./calendar/WorkersColumn";
import { TimelineHeader } from "./calendar/TimelineHeader";
import { CalendarGrid } from "./calendar/CalendarGrid";
import { UnassignedTasks } from "./calendar/UnassignedTasks";
import { StatusLegend } from "./calendar/StatusLegend";
import { DragPreview } from "./calendar/DragPreview";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { CreateTaskModal } from "./modals/CreateTaskModal";
import { TaskDetailsModal } from "./modals/TaskDetailsModal";
import { useDragAndDrop } from "@/hooks/useDragAndDrop";
import { useToast } from "@/hooks/use-toast";
import { Task } from "@/hooks/useCalendarData";

const CleaningCalendar = () => {
  const {
    tasks,
    cleaners,
    currentDate,
    currentView,
    isLoading,
    setCurrentView,
    navigateDate,
    goToToday,
    updateTask,
    assignTask,
    createTask,
    deleteTask
  } = useCalendarData();

  const { toast } = useToast();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  
  // Refs for scroll synchronization
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);

  // Generate time slots
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 6; hour <= 22; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      if (hour < 22) {
        slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
    }
    return slots;
  }, []);

  // Handle scroll synchronization
  const handleHeaderScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (bodyScrollRef.current) {
      bodyScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const handleBodyScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  // Handle task assignment
  const handleTaskAssign = async (taskId: string, cleanerId: string, startTime: string) => {
    try {
      await assignTask({ taskId, cleanerId });
      toast({
        title: "Tarea asignada",
        description: "La tarea se ha asignado correctamente.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo asignar la tarea.",
        variant: "destructive",
      });
    }
  };

  // Initialize drag and drop
  const {
    dragState,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop
  } = useDragAndDrop(handleTaskAssign);

  // Handle new task creation
  const handleNewTask = () => {
    setIsCreateModalOpen(true);
  };

  // Handle task creation
  const handleCreateTask = async (taskData: Omit<Task, 'id'>) => {
    try {
      await createTask(taskData);
      toast({
        title: "Tarea creada",
        description: "La nueva tarea se ha creado correctamente.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo crear la tarea.",
        variant: "destructive",
      });
    }
  };

  // Handle task details
  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  // Handle task update
  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      await updateTask({ taskId, updates });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar la tarea.",
        variant: "destructive",
      });
    }
  };

  // Handle task deletion
  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar la tarea.",
        variant: "destructive",
      });
    }
  };

  // Get task position for timeline
  const getTaskPosition = (startTime: string, endTime: string) => {
    const timeToMinutes = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    
    // Each time slot is 75px wide and represents 30 minutes
    const slotWidth = 75; // pixels
    const minutesPerSlot = 30; // minutes
    const dayStartMinutes = 6 * 60; // 6:00 AM
    
    // Calculate position based on slots from day start
    const slotsFromStart = (startMinutes - dayStartMinutes) / minutesPerSlot;
    const durationInSlots = (endMinutes - startMinutes) / minutesPerSlot;
    
    const leftPixels = slotsFromStart * slotWidth;
    const widthPixels = durationInSlots * slotWidth;
    
    return { 
      left: `${leftPixels}px`, 
      width: `${Math.max(widthPixels, 120)}px` // Minimum width of 120px
    };
  };

  // Check if a time slot is occupied
  const isTimeSlotOccupied = (cleanerId: string, hour: number, minute: number) => {
    const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    return assignedTasks.some(task => 
      task.cleaner === cleaners.find(c => c.id === cleanerId)?.name &&
      task.startTime <= timeString && task.endTime > timeString
    );
  };

  // Get tasks assigned to cleaners
  const assignedTasks = tasks.filter(task => task.cleaner);
  const unassignedTasks = tasks.filter(task => !task.cleaner);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <LoadingSpinner size="lg" text="Cargando calendario..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <div className="space-y-6 container-responsive py-6">
        {/* Enhanced Responsive Header */}
        <ResponsiveCalendarHeader
          currentDate={currentDate}
          currentView={currentView}
          onNavigateDate={navigateDate}
          onGoToToday={goToToday}
          onViewChange={setCurrentView}
          onNewTask={handleNewTask}
        />

        {/* Main Calendar with Enhanced Design */}
        <Card className="border-0 shadow-xl overflow-hidden bg-card animate-fade-in">
          <CardContent className="p-0">
            <div className="flex h-[600px] overflow-hidden">
              {/* Workers Column */}
              <WorkersColumn cleaners={cleaners} />

              {/* Timeline Area */}
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Time Header - Scrollable */}
                <TimelineHeader
                  ref={headerScrollRef}
                  timeSlots={timeSlots}
                  onScroll={handleHeaderScroll}
                />

                {/* Timeline Body - Scrollable */}
                <CalendarGrid
                  ref={bodyScrollRef}
                  cleaners={cleaners}
                  timeSlots={timeSlots}
                  assignedTasks={assignedTasks}
                  dragState={dragState}
                  onScroll={handleBodyScroll}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onTaskClick={handleTaskClick}
                  getTaskPosition={getTaskPosition}
                  isTimeSlotOccupied={isTimeSlotOccupied}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Unassigned Tasks */}
        <UnassignedTasks
          tasks={unassignedTasks}
          onTaskClick={handleTaskClick}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        />

        {/* Drag Preview with Enhanced Styling */}
        {dragState.draggedTask && (
          <DragPreview
            task={dragState.draggedTask}
            isDragging={dragState.isDragging}
            offset={dragState.dragOffset}
          />
        )}

        {/* Enhanced Status Legend */}
        <StatusLegend />

        {/* Modals */}
        <CreateTaskModal
          open={isCreateModalOpen}
          onOpenChange={setIsCreateModalOpen}
          onCreateTask={handleCreateTask}
          currentDate={currentDate}
        />

        <TaskDetailsModal
          task={selectedTask}
          open={isTaskModalOpen}
          onOpenChange={setIsTaskModalOpen}
          onUpdateTask={handleUpdateTask}
          onDeleteTask={handleDeleteTask}
        />
      </div>
    </div>
  );
};

export default CleaningCalendar;
