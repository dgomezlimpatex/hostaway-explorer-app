
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
              <CardHeader className="text-center">
                <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">📅</div>
                <CardTitle className="text-xl font-semibold text-gray-800">
                  Calendario
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center text-gray-600 mb-4">
                  Gestiona tareas y horarios de limpieza de manera eficiente. 
                  Programa y organiza todas tus actividades diarias.
                </CardDescription>
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                    Programación
                  </span>
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                    Horarios
                  </span>
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                    Tareas
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Tareas */}
          <Link to="/tasks" className="group">
            <Card className="h-full transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-pointer border-2 hover:border-yellow-300">
              <CardHeader className="text-center">
                <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">✅</div>
                <CardTitle className="text-xl font-semibold text-gray-800">
                  Gestión de Tareas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center text-gray-600 mb-4">
                  Administra y supervisa todas las tareas de limpieza. 
                  Filtra, organiza y controla el estado de cada trabajo.
                </CardDescription>
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                    Lista de Tareas
                  </span>
                  <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                    Filtros
                  </span>
                  <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                    Estados
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Clientes */}
          <Link to="/clients" className="group">
            <Card className="h-full transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-pointer border-2 hover:border-green-300">
              <CardHeader className="text-center">
                <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">👥</div>
                <CardTitle className="text-xl font-semibold text-gray-800">
                  Clientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center text-gray-600 mb-4">
                  Administra la información completa de tus clientes. 
                  Gestiona contactos, direcciones y preferencias de servicio.
                </CardDescription>
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                    Contactos
                  </span>
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                    Direcciones
                  </span>
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                    Servicios
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Propiedades */}
          <Link to="/properties" className="group">
            <Card className="h-full transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-pointer border-2 hover:border-purple-300">
              <CardHeader className="text-center">
                <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">🏠</div>
                <CardTitle className="text-xl font-semibold text-gray-800">
                  Propiedades
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center text-gray-600 mb-4">
                  Gestiona pisos y propiedades de limpieza. 
                  Controla características, servicios y detalles específicos.
                </CardDescription>
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">
                    Pisos
                  </span>
                  <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">
                    Características
                  </span>
                  <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">
                    Servicios
                  </span>
                </div>
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
                <CardDescription className="text-center text-gray-600 mb-4">
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
          <Card className="h-full transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-pointer border-2 hover:border-indigo-300">
            <CardHeader className="text-center">
              <div className="text-4xl mb-2 hover:scale-110 transition-transform">📈</div>
              <CardTitle className="text-xl font-semibold text-gray-800">
                Estadísticas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center text-gray-600 mb-4">
                Análisis y estadísticas del negocio en tiempo real. 
                Métricas de rendimiento y dashboards interactivos.
              </CardDescription>
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full">
                  Métricas
                </span>
                <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full">
                  Dashboards
                </span>
                <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full">
                  Análisis
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Configuración */}
          <Card className="h-full transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-pointer border-2 hover:border-gray-300">
            <CardHeader className="text-center">
              <div className="text-4xl mb-2 hover:scale-110 transition-transform">⚙️</div>
              <CardTitle className="text-xl font-semibold text-gray-800">
                Configuración
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center text-gray-600 mb-4">
                Configura tu sistema de limpieza personalizado. 
                Ajusta preferencias, usuarios y parámetros del sistema.
              </CardDescription>
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">
                  Preferencias
                </span>
                <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">
                  Usuarios
                </span>
                <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">
                  Sistema
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
