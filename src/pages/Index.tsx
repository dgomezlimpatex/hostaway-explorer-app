
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, Home, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Sistema de Gestión de Limpieza
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Administra tu negocio de limpieza de manera eficiente con nuestro sistema integral
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link to="/calendar">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
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

          <Link to="/clients">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
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

          <Link to="/properties">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
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

          <Card className="hover:shadow-lg transition-shadow cursor-pointer opacity-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-orange-600" />
                Reportes
              </CardTitle>
              <CardDescription>
                Análisis y estadísticas del negocio
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" disabled>
                Próximamente
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
