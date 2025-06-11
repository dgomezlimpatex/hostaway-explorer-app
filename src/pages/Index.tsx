
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Users, Building, ClipboardList, BarChart3, User } from "lucide-react";
import { Link } from "react-router-dom";
import { HostawayIntegrationWidget } from "@/components/hostaway/HostawayIntegrationWidget";

const Index = () => {
  const menuItems = [
    {
      title: "Calendario",
      description: "Gestiona las tareas de limpieza",
      icon: Calendar,
      path: "/calendar",
      color: "bg-blue-500"
    },
    {
      title: "Tareas",
      description: "Administra todas las tareas",
      icon: ClipboardList,
      path: "/tasks",
      color: "bg-green-500"
    },
    {
      title: "Clientes",
      description: "Gestiona la información de clientes",
      icon: Users,
      path: "/clients",
      color: "bg-purple-500"
    },
    {
      title: "Propiedades",
      description: "Administra las propiedades",
      icon: Building,
      path: "/properties",
      color: "bg-orange-500"
    },
    {
      title: "Trabajadores",
      description: "Gestiona tu equipo de limpieza",
      icon: User,
      path: "/workers",
      color: "bg-cyan-500"
    },
    {
      title: "Informes",
      description: "Visualiza estadísticas y reportes",
      icon: BarChart3,
      path: "/reports",
      color: "bg-red-500"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Sistema de Gestión de Limpieza
          </h1>
          <p className="text-lg text-gray-600">
            Administra tu negocio de limpieza de manera eficiente
          </p>
        </div>

        {/* Widget de Hostaway */}
        <div className="mb-8">
          <HostawayIntegrationWidget />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuItems.map((item) => (
            <Link key={item.path} to={item.path}>
              <Card className="hover:shadow-lg transition-shadow duration-200 h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`${item.color} p-2 rounded-lg`}>
                      <item.icon className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle className="text-xl">{item.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">{item.description}</p>
                  <Button className="w-full mt-4" variant="outline">
                    Acceder
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Index;
