
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock, AlertCircle, Calendar } from "lucide-react";

const StatsCards = () => {
  const stats = [
    {
      title: "Hoy",
      value: "8",
      subtitle: "limpiezas programadas",
      icon: Calendar,
      color: "text-blue-600",
      bg: "bg-blue-50"
    },
    {
      title: "Completadas",
      value: "5",
      subtitle: "de 8 hoy",
      icon: CheckCircle,
      color: "text-green-600",
      bg: "bg-green-50"
    },
    {
      title: "En Progreso",
      value: "2",
      subtitle: "actualmente",
      icon: Clock,
      color: "text-yellow-600",
      bg: "bg-yellow-50"
    },
    {
      title: "Pendientes",
      value: "1",
      subtitle: "por asignar",
      icon: AlertCircle,
      color: "text-red-600",
      bg: "bg-red-50"
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <Card key={index} className="border-0 shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              {stat.title}
            </CardTitle>
            <div className={`p-2 rounded-full ${stat.bg}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            <p className="text-xs text-gray-500 mt-1">{stat.subtitle}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default StatsCards;
