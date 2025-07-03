import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Calendar as CalendarIcon, ExternalLink } from "lucide-react";
import { Task } from "@/types/calendar";
import { Link } from "react-router-dom";
interface CalendarIntegrationWidgetProps {
  tasks: Task[];
}
export const CalendarIntegrationWidget = ({
  tasks
}: CalendarIntegrationWidgetProps) => {
  const today = new Date().toISOString().split('T')[0];
  const todayTasks = tasks.filter(task => task.date === today);
  const upcomingTasks = tasks.filter(task => task.date > today).slice(0, 3).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "in-progress":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "pending":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };
  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "Completado";
      case "in-progress":
        return "En Progreso";
      case "pending":
        return "Pendiente";
      default:
        return "Sin estado";
    }
  };
  return <Card className="shadow-sm border-0 bg-gradient-to-br from-blue-50 to-indigo-50">
      
      
    </Card>;
};