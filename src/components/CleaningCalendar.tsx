import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useMemo, useRef } from "react";
import { useCalendarData } from "@/hooks/useCalendarData";
import { CalendarHeader } from "./calendar/CalendarHeader";
import { TaskCard } from "./calendar/TaskCard";
import { TimeSlot } from "./calendar/TimeSlot";
import { DragPreview } from "./calendar/DragPreview";
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
    const dayStartMinutes = 6 * 60; // 6:00 AM
    
    const leftPercent = ((startMinutes - dayStartMinutes) / (16 * 60)) * 100;
    const widthPercent = ((endMinutes - startMinutes) / (16 * 60)) * 100;
    
    return { left: `${leftPercent}%`, width: `${widthPercent}%` };
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Cargando calendario...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Modern Header */}
      <CalendarHeader
        currentDate={currentDate}
        currentView={currentView}
        onNavigateDate={navigateDate}
        onGoToToday={goToToday}
        onViewChange={setCurrentView}
        onNewTask={handleNewTask}
      />

      {/* Main Calendar */}
      <Card className="border-0 shadow-xl overflow-hidden">
        <CardContent className="p-0">
          <div className="flex h-[600px] overflow-hidden">
            {/* Workers Column */}
            <div className="w-48 bg-gray-50 border-r border-gray-200 flex-shrink-0">
              {/* Header */}
              <div className="h-16 bg-white border-b border-gray-200 flex items-center px-4">
                <span className="font-semibold text-gray-700">Trabajadores</span>
              </div>
              
              {/* Workers List */}
              <ScrollArea className="h-[544px]">
                {cleaners.map((cleaner) => (
                  <div 
                    key={cleaner.id} 
                    className="h-20 border-b border-gray-200 p-3 flex items-center hover:bg-gray-100 transition-colors"
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
              </ScrollArea>
            </div>

            {/* Timeline Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              {/* Time Header - Scrollable */}
              <div 
                ref={headerScrollRef}
                className="h-16 bg-white border-b border-gray-200 overflow-x-auto"
                onScroll={handleHeaderScroll}
              >
                <div className="flex h-full" style={{ minWidth: '1200px' }}>
                  {timeSlots.map((time, index) => (
                    <div 
                      key={time} 
                      className={`min-w-[75px] h-16 flex items-center justify-center text-xs font-medium text-gray-600 border-r border-gray-100 ${
                        time.endsWith(':00') ? 'bg-gray-50' : 'bg-white'
                      }`}
                    >
                      {time.endsWith(':00') ? time : ''}
                    </div>
                  ))}
                </div>
              </div>

              {/* Timeline Body - Scrollable */}
              <div 
                ref={bodyScrollRef}
                className="flex-1 overflow-x-auto overflow-y-auto"
                onScroll={handleBodyScroll}
              >
                <div style={{ minWidth: '1200px' }}>
                  {cleaners.map((cleaner) => {
                    const cleanerTasks = assignedTasks.filter(task => task.cleaner === cleaner.name);
                    
                    return (
                      <div key={cleaner.id} className="h-20 border-b border-gray-100 relative hover:bg-gray-25 transition-colors flex">
                        {/* Time slots for this cleaner */}
                        {timeSlots.map((time, index) => {
                          const [hour, minute] = time.split(':').map(Number);
                          const isOccupied = isTimeSlotOccupied(cleaner.id, hour, minute);
                          
                          return (
                            <TimeSlot
                              key={`${cleaner.id}-${time}`}
                              hour={hour}
                              minute={minute}
                              cleanerId={cleaner.id}
                              isOccupied={isOccupied}
                              onDragOver={handleDragOver}
                              onDrop={handleDrop}
                            />
                          );
                        })}

                        {/* Tasks for this cleaner */}
                        {cleanerTasks.map((task) => {
                          const position = getTaskPosition(task.startTime, task.endTime);
                          return (
                            <div
                              key={task.id}
                              className="absolute top-1 bottom-1 z-10"
                              style={{
                                left: position.left,
                                width: position.width,
                                minWidth: '120px'
                              }}
                            >
                              <TaskCard
                                task={task}
                                onClick={() => handleTaskClick(task)}
                                isDragging={dragState.draggedTask?.id === task.id}
                                onDragStart={handleDragStart}
                                onDragEnd={handleDragEnd}
                                style={{ height: '100%' }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unassigned Tasks */}
      {unassignedTasks.length > 0 && (
        <Card className="border border-orange-200 shadow-lg">
          <CardContent className="p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              📋 Tareas Sin Asignar 
              <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">
                {unassignedTasks.length}
              </span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {unassignedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={() => handleTaskClick(task)}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Drag Preview */}
      {dragState.draggedTask && (
        <DragPreview
          task={dragState.draggedTask}
          isDragging={dragState.isDragging}
          offset={dragState.dragOffset}
        />
      )}

      {/* Status Legend */}
      <div className="flex items-center gap-6 text-sm bg-white p-4 rounded-lg shadow-sm">
        <span className="text-gray-600 font-medium">Estado:</span>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <span>Pendiente</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
          <span>En Progreso</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span>Completado</span>
        </div>
      </div>

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

      {/* CSS for drag effects */}
      <style>{`
        .drag-over .drop-indicator {
          opacity: 1;
        }
        
        .time-cell:hover .drop-indicator {
          opacity: 0.3;
        }
        
        @keyframes dragPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        .dragging {
          animation: dragPulse 1s infinite;
        }
      `}</style>
    </div>
  );
};

export default CleaningCalendar;
