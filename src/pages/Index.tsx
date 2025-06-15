
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Users, Building, ClipboardList, BarChart3, User, ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { HostawayIntegrationWidget } from "@/components/hostaway/HostawayIntegrationWidget";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import StatsCards from "@/components/StatsCards";

const Index = () => {
  const menuItems = [
    {
      title: "Calendario",
      description: "Gestiona las tareas de limpieza y horarios",
      icon: Calendar,
      path: "/calendar",
      color: "from-blue-500 to-blue-600",
      bgAccent: "bg-blue-50",
      iconColor: "text-blue-600"
    },
    {
      title: "Tareas",
      description: "Administra y supervisa todas las tareas",
      icon: ClipboardList,
      path: "/tasks",
      color: "from-green-500 to-green-600",
      bgAccent: "bg-green-50",
      iconColor: "text-green-600"
    },
    {
      title: "Clientes",
      description: "Gestiona la base de datos de clientes",
      icon: Users,
      path: "/clients",
      color: "from-purple-500 to-purple-600",
      bgAccent: "bg-purple-50",
      iconColor: "text-purple-600"
    },
    {
      title: "Propiedades",
      description: "Administra el catálogo de propiedades",
      icon: Building,
      path: "/properties",
      color: "from-orange-500 to-orange-600",
      bgAccent: "bg-orange-50",
      iconColor: "text-orange-600"
    },
    {
      title: "Trabajadores",
      description: "Gestiona tu equipo de limpieza",
      icon: User,
      path: "/workers",
      color: "from-cyan-500 to-cyan-600",
      bgAccent: "bg-cyan-50",
      iconColor: "text-cyan-600"
    },
    {
      title: "Informes",
      description: "Visualiza estadísticas y reportes",
      icon: BarChart3,
      path: "/reports",
      color: "from-red-500 to-red-600",
      bgAccent: "bg-red-50",
      iconColor: "text-red-600"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10"></div>
        <div className="relative max-w-7xl mx-auto px-6 py-8">
          <div className="flex justify-between items-center mb-12">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">CleanPro</h1>
                <p className="text-sm text-gray-600 dark:text-gray-300">Sistema de Gestión</p>
              </div>
            </div>
            <ThemeToggle />
          </div>

          {/* Hero Section */}
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
              Gestión Profesional de 
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"> Limpieza</span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-8 leading-relaxed">
              Administra tu negocio de limpieza de manera eficiente con herramientas profesionales 
              para la gestión de tareas, trabajadores y propiedades.
            </p>
            <div className="flex justify-center gap-4">
              <Link to="/calendar">
                <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300">
                  Ir al Calendario
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/tasks">
                <Button variant="outline" size="lg" className="px-8 py-3 rounded-xl border-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300">
                  Ver Tareas
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pb-12">
        {/* Stats Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Resumen de Hoy</h2>
          <StatsCards />
        </section>

        {/* Hostaway Integration */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Integración Hostaway</h2>
          <HostawayIntegrationWidget />
        </section>

        {/* Navigation Cards */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Módulos del Sistema</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {menuItems.map((item) => (
              <Link key={item.path} to={item.path} className="group">
                <Card className="h-full hover:shadow-2xl transition-all duration-300 border-0 shadow-lg hover:-translate-y-1 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-4 ${item.bgAccent} dark:bg-gray-700 rounded-2xl group-hover:scale-110 transition-transform duration-300`}>
                        <item.icon className={`h-8 w-8 ${item.iconColor} dark:text-gray-300`} />
                      </div>
                      <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 group-hover:translate-x-1 transition-all duration-300" />
                    </div>
                    <CardTitle className="text-xl text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300">
                      {item.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
                      {item.description}
                    </p>
                    <div className={`h-1 w-full bg-gradient-to-r ${item.color} rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-20 pt-8 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400">
              © 2024 CleanPro. Sistema de gestión profesional de limpieza.
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default Index;
