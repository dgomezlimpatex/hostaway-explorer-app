import React, { useState } from 'react';
import { Task, Cleaner } from '@/types/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar, Plus, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ManagerMobileCalendarProps {
  currentDate: Date;
  tasks: Task[];
  cleaners: Cleaner[];
  onNavigateDate: (direction: 'prev' | 'next') => void;
  onTaskClick: (task: Task) => void;
  onNewTask: () => void;
}

export const ManagerMobileCalendar: React.FC<ManagerMobileCalendarProps> = ({
  currentDate,
  tasks,
  cleaners,
  onNavigateDate,
  onTaskClick,
  onNewTask
}) => {
  const [selectedCleaner, setSelectedCleaner] = useState<string>('all');
  
  const currentDateStr = currentDate.toISOString().split('T')[0];
  const dayTasks = tasks.filter(task => task.date === currentDateStr);
  
  // Get unassigned tasks
  const unassignedTasks = dayTasks.filter(task => !task.cleaner && !task.cleanerId);
  
  // Get assigned tasks (exclude unassigned ones)
  const assignedTasks = dayTasks.filter(task => task.cleaner || task.cleanerId);
  
  // Filter assigned tasks by selected cleaner
  const filteredTasks = selectedCleaner === 'all' 
    ? assignedTasks 
    : assignedTasks.filter(task => task.cleanerId === selectedCleaner);
    
  // Group tasks by time
  const tasksByTime = filteredTasks.sort((a, b) => a.startTime.localeCompare(b.startTime));
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in-progress': return 'bg-blue-500'; 
      case 'pending': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header with date navigation */}
      <div className="sticky top-0 z-10 bg-background border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => onNavigateDate('prev')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="text-center">
            <h2 className="font-semibold text-lg">
              {format(currentDate, 'EEEE', { locale: es })}
            </h2>
            <p className="text-sm text-muted-foreground">
              {format(currentDate, 'dd MMMM yyyy', { locale: es })}
            </p>
          </div>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => onNavigateDate('next')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mb-4">
          <Button onClick={onNewTask} className="flex-1">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Tarea
          </Button>
        </div>

        {/* Cleaner filter */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <Button
            variant={selectedCleaner === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCleaner('all')}
          >
            Todos ({assignedTasks.length})
          </Button>
          {cleaners.map(cleaner => {
            const cleanerTasks = assignedTasks.filter(task => task.cleanerId === cleaner.id);
            return (
              <Button
                key={cleaner.id}
                variant={selectedCleaner === cleaner.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCleaner(cleaner.id)}
                className="whitespace-nowrap"
              >
                {cleaner.name} ({cleanerTasks.length})
              </Button>
            );
          })}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Unassigned tasks section */}
        {unassignedTasks.length > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-orange-800 flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Tareas Sin Asignar ({unassignedTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {unassignedTasks.map(task => (
                <div
                  key={task.id}
                  onClick={() => onTaskClick(task)}
                  className="p-3 bg-white rounded-lg border border-orange-200 shadow-sm active:scale-95 transition-transform"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{task.property}</h4>
                      <p className="text-xs text-muted-foreground mb-2">{task.address}</p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-medium">{task.startTime} - {task.endTime}</span>
                        <Badge variant="outline" className="text-xs">
                          {task.type}
                        </Badge>
                      </div>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(task.status)}`} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Assigned tasks */}
        {filteredTasks.length > 0 ? (
          <div className="space-y-3">
            {tasksByTime.map(task => (
              <Card
                key={task.id}
                onClick={() => onTaskClick(task)}
                className="active:scale-95 transition-transform cursor-pointer"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-sm">{task.startTime} - {task.endTime}</span>
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(task.status)}`} />
                      </div>
                      
                      <h4 className="font-medium">{task.property}</h4>
                      <p className="text-sm text-muted-foreground mb-2">{task.address}</p>
                      
                      {task.cleaner && (
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="secondary" className="text-xs">
                            {task.cleaner}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {task.type}
                          </Badge>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {task.checkIn && <span>Check-in: {task.checkIn}</span>}
                        {task.checkOut && <span>Check-out: {task.checkOut}</span>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">No hay tareas</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {selectedCleaner === 'all' 
                  ? 'No hay tareas programadas para este día'
                  : 'No hay tareas asignadas a este limpiador para este día'
                }
              </p>
              <Button onClick={onNewTask} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Crear Nueva Tarea
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};