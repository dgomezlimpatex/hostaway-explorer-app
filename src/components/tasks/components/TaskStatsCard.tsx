
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, AlertCircle, Users, Euro, Calendar } from "lucide-react";
import { Task } from "@/types/calendar";

interface TaskStatsCardProps {
  tasks: Task[];
}

export const TaskStatsCard = React.memo(({ tasks }: TaskStatsCardProps) => {
  const stats = React.useMemo(() => {
    const pending = tasks.filter(t => t.status === 'pending').length;
    const inProgress = tasks.filter(t => t.status === 'in-progress').length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const unassigned = tasks.filter(t => !t.cleaner).length;
    const totalRevenue = tasks
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + (t.coste || 0), 0);
    const todayTasks = tasks.filter(t => t.date === new Date().toISOString().split('T')[0]).length;

    return { pending, inProgress, completed, unassigned, totalRevenue, todayTasks };
  }, [tasks]);

  const statsConfig = React.useMemo(() => [
    {
      title: "Pendientes",
      value: stats.pending,
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      badgeColor: "bg-yellow-100 text-yellow-800"
    },
    {
      title: "En Progreso",
      value: stats.inProgress,
      icon: AlertCircle,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      badgeColor: "bg-blue-100 text-blue-800"
    },
    {
      title: "Completadas",
      value: stats.completed,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
      badgeColor: "bg-green-100 text-green-800"
    },
    {
      title: "Sin Asignar",
      value: stats.unassigned,
      icon: Users,
      color: "text-red-600",
      bgColor: "bg-red-50",
      badgeColor: "bg-red-100 text-red-800"
    },
    {
      title: "Ingresos Completados",
      value: `${stats.totalRevenue.toFixed(2)}€`,
      icon: Euro,
      color: "text-green-600",
      bgColor: "bg-green-50",
      badgeColor: "bg-green-100 text-green-800"
    },
    {
      title: "Tareas Hoy",
      value: stats.todayTasks,
      icon: Calendar,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      badgeColor: "bg-purple-100 text-purple-800"
    }
  ], [stats]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {statsConfig.map((stat, index) => (
        <Card key={index} className="hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className={`p-2 rounded-full ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{stat.title}</p>
                <Badge variant="secondary" className={`text-xs ${stat.badgeColor} border-0`}>
                  {stat.value}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
});

TaskStatsCard.displayName = 'TaskStatsCard';
