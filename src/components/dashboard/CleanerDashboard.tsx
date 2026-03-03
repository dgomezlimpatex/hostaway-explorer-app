
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { UserMenu } from '@/components/auth/UserMenu';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, Calendar, User, Clock, MapPin, CheckCircle2, Loader2 } from "lucide-react";
import { useTasks } from '@/hooks/useTasks';
import { useAuth } from '@/hooks/useAuth';
import { useCleaners } from '@/hooks/useCleaners';
import { useMemo, useState } from 'react';
import { Task } from '@/types/calendar';
import { TaskReportModal } from '@/components/modals/TaskReportModal';

interface CleanerDashboardProps {
  userFullName?: string | null;
  userEmail?: string | null;
}

export const CleanerDashboard = ({ userFullName, userEmail }: CleanerDashboardProps) => {
  const { user } = useAuth();
  const { cleaners } = useCleaners();
  const today = useMemo(() => new Date(), []);
  const { tasks, isLoading } = useTasks(today, 'day');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Find the cleaner record for the current user
  const currentCleaner = useMemo(() => {
    if (!user?.id) return null;
    return cleaners.find(c => c.user_id === user.id) || null;
  }, [cleaners, user?.id]);

  // Filter only today's tasks assigned to this cleaner
  const todayTasks = useMemo(() => {
    if (!tasks || !currentCleaner) return [];
    const todayStr = today.toISOString().split('T')[0];
    return tasks
      .filter(t => t.date === todayStr && t.cleanerId === currentCleaner.id)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [tasks, currentCleaner, today]);

  const completedCount = todayTasks.filter(t => t.status === 'completed').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg shadow-lg border-b border-white/20">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                Panel de Trabajador
              </h1>
              <p className="text-gray-700 mt-1">
                Bienvenido/a, {userFullName || userEmail}
              </p>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mt-2">
                <User className="h-3 w-3 mr-1" />
                Limpiador/a
              </span>
            </div>
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Welcome Message */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              ¿Qué deseas hacer hoy?
            </h2>
            <p className="text-gray-600">
              Accede a tus herramientas de trabajo diarias
            </p>
          </div>

          {/* Today's Tasks Card */}
          <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-green-100 to-green-200 w-12 h-12 rounded-full flex items-center justify-center">
                  <ClipboardList className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Tareas de Hoy</h3>
                  <p className="text-sm text-gray-500">
                    {today.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                </div>
              </div>
              {todayTasks.length > 0 && (
                <Badge className="bg-green-100 text-green-800 border-green-300 text-sm px-3 py-1">
                  {completedCount}/{todayTasks.length} completadas
                </Badge>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-green-600" />
                <span className="ml-2 text-gray-500">Cargando tareas...</span>
              </div>
            ) : todayTasks.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">🎉</div>
                <p className="text-lg font-medium text-gray-700">No tienes tareas para hoy</p>
                <p className="text-sm text-gray-500 mt-1">Disfruta de tu día libre</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 hover:shadow-md ${
                      task.status === 'completed'
                        ? 'bg-green-50 border-green-200 hover:bg-green-100'
                        : task.status === 'in-progress'
                        ? 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 truncate">{task.property}</h4>
                        <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate">{task.address}</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                          <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                          <span>{task.startTime} - {task.endTime}</span>
                        </div>
                      </div>
                      <Badge
                        className={`ml-2 flex-shrink-0 ${
                          task.status === 'completed'
                            ? 'bg-green-100 text-green-800 border-green-300'
                            : task.status === 'in-progress'
                            ? 'bg-blue-100 text-blue-800 border-blue-300'
                            : 'bg-orange-100 text-orange-800 border-orange-300'
                        }`}
                      >
                        {task.status === 'completed' ? (
                          <><CheckCircle2 className="h-3 w-3 mr-1" /> Completada</>
                        ) : task.status === 'in-progress' ? (
                          'En Progreso'
                        ) : (
                          'Pendiente'
                        )}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Calendar Card */}
          <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-gradient-to-br from-blue-100 to-blue-200 w-12 h-12 rounded-full flex items-center justify-center">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Mi Calendario</h3>
                <p className="text-sm text-gray-500">Visualiza tu horario y planifica tu semana</p>
              </div>
            </div>
            <Link to="/calendar" className="block">
              <Button size="lg" variant="outline" className="w-full text-lg py-3 border-2 border-blue-500 text-blue-600 hover:bg-blue-50 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300">
                Ver Mi Calendario
              </Button>
            </Link>
          </div>

          {/* Reminder */}
          <div className="mt-8 bg-gradient-to-r from-blue-500 to-green-500 rounded-2xl p-6 text-white">
            <div className="text-center">
              <h4 className="text-lg font-semibold mb-2">💡 Recordatorio</h4>
              <p className="text-blue-100">
                Recuerda actualizar el estado de tus tareas una vez completadas y reportar cualquier problema encontrado durante la limpieza.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Task Report Modal */}
      {selectedTask && (
        <TaskReportModal
          task={selectedTask}
          open={!!selectedTask}
          onOpenChange={(open) => { if (!open) setSelectedTask(null); }}
        />
      )}
    </div>
  );
};
