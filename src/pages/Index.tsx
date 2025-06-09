import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, Home, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";

export default function Index() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🧹 Sistema de Gestión de Limpieza
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Gestiona tu negocio de limpieza de manera eficiente con nuestro sistema completo
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {/* Calendario */}
          <Link to="/calendar" className="group">
            <Card className="h-full transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-pointer border-2 hover:border-blue-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  Calendario
                </CardTitle>
                <CardDescription>
                  Gestiona tareas y horarios de limpieza
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full">
                  Ir al Calendario
                </Button>
              </CardContent>
            </Card>
          </Link>

          {/* Clientes */}
          <Link to="/clients" className="group">
            <Card className="h-full transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-pointer border-2 hover:border-green-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-green-600" />
                  Clientes
                </CardTitle>
                <CardDescription>
                  Administra la información de tus clientes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full">
                  Gestionar Clientes
                </Button>
              </CardContent>
            </Card>
          </Link>

          {/* Propiedades */}
          <Link to="/properties" className="group">
            <Card className="h-full transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-pointer border-2 hover:border-purple-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5 text-purple-600" />
                  Propiedades
                </CardTitle>
                <CardDescription>
                  Gestiona pisos y propiedades de limpieza
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full">
                  Gestionar Propiedades
                </Button>
              </CardContent>
            </Card>
          </Link>

          {/* Reportes */}
          <Link to="/reports" className="group">
            <Card className="h-full transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-pointer border-2 hover:border-orange-300">
              <CardHeader className="text-center">
                <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">📊</div>
                <CardTitle className="text-xl font-semibold text-gray-800">
                  Sistema de Reportes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center text-gray-600">
                  Genera reportes detallados de tareas, facturación y resúmenes. 
                  Exporta datos en CSV con filtros avanzados.
                </CardDescription>
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">
                    Listado Tareas
                  </span>
                  <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">
                    Facturación
                  </span>
                  <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">
                    Exportar CSV
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Estadísticas */}
          <Card className="h-full transition-all duration-300 hover:shadow-lg border-2 hover:border-indigo-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-orange-600" />
                Estadísticas
              </CardTitle>
              <CardDescription>
                Análisis y estadísticas del negocio
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">
                Ver Estadísticas
              </Button>
            </CardContent>
          </Card>

          {/* Configuración */}
          <Card className="h-full transition-all duration-300 hover:shadow-lg border-2 hover:border-gray-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="h-5 w-5 text-gray-600" />
                Configuración
              </CardTitle>
              <CardDescription>
                Configura tu sistema de limpieza
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">
                Configurar
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
