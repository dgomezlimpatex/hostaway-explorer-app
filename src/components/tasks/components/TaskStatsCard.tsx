
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Task } from "@/types/calendar";

interface TaskStatsCardProps {
  tasks: Task[];
}

export const TaskStatsCard = ({ tasks }: TaskStatsCardProps) => {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length;
  const pendingTasks = tasks.filter(t => t.status === 'pending').length;
  
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  const totalRevenue = tasks
    .filter(t => t.status === 'completed' && t.coste)
    .reduce((sum, t) => sum + (t.coste || 0), 0);

  const averageTaskDuration = tasks
    .filter(t => t.duracion)
    .reduce((sum, t, _, arr) => sum + (t.duracion || 0) / arr.length, 0);

  const assignedTasks = tasks.filter(t => t.cleaner).length;
  const assignmentRate = totalTasks > 0 ? Math.round((assignedTasks / totalTasks) * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Total de Tareas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalTasks}</div>
          <div className="flex gap-2 mt-2">
            <Badge variant="outline" className="text-xs">
              Completadas: {completedTasks}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Tasa de Finalización</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 mb-3">{completionRate}%</div>
            <div className="grid grid-cols-3 gap-1 text-xs">
              <div className="bg-green-100 rounded-lg p-2 text-center">
                <div className="font-semibold text-green-800">{completedTasks}</div>
                <div className="text-green-600">completadas</div>
              </div>
              <div className="bg-yellow-100 rounded-lg p-2 text-center">
                <div className="font-semibold text-yellow-800">{inProgressTasks}</div>
                <div className="text-yellow-600">en progreso</div>
              </div>
              <div className="bg-red-100 rounded-lg p-2 text-center">
                <div className="font-semibold text-red-800">{pendingTasks}</div>
                <div className="text-red-600">pendientes</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Ingresos Generados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">€{totalRevenue}</div>
          <div className="text-xs text-gray-500 mt-1">
            De tareas completadas
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Asignación de Personal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-600">{assignmentRate}%</div>
          <div className="text-xs text-gray-500 mt-1">
            {assignedTasks} de {totalTasks} tareas asignadas
          </div>
          {averageTaskDuration > 0 && (
            <div className="text-xs text-gray-500 mt-1">
              Duración promedio: {Math.round(averageTaskDuration)} min
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
