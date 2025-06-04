
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Clock, User, Search, Filter } from "lucide-react";
import { useState } from "react";

const CleaningList = () => {
  const [searchTerm, setSearchTerm] = useState("");

  const allCleanings = [
    {
      id: 1,
      property: "Apartamento Centro - 2A",
      address: "Calle Mayor 123",
      date: "Hoy",
      time: "10:00 - 12:00",
      cleaner: "María García",
      status: "completed",
      priority: "high"
    },
    {
      id: 2,
      property: "Villa Costa del Sol",
      address: "Av. Marítima 45",
      date: "Hoy",
      time: "13:00 - 16:00",
      cleaner: "Ana López",
      status: "in-progress",
      priority: "medium"
    },
    {
      id: 3,
      property: "Estudio Malasaña",
      address: "Calle Fuencarral 78",
      date: "Hoy",
      time: "16:30 - 18:00",
      cleaner: "Sin asignar",
      status: "pending",
      priority: "high"
    },
    {
      id: 4,
      property: "Loft Salamanca",
      address: "Calle Serrano 156",
      date: "Mañana",
      time: "09:00 - 11:30",
      cleaner: "Carlos Ruiz",
      status: "scheduled",
      priority: "low"
    },
    {
      id: 5,
      property: "Dúplex Retiro",
      address: "Calle Alcalá 89",
      date: "Mañana",
      time: "14:00 - 17:00",
      cleaner: "Laura Martín",
      status: "scheduled",
      priority: "medium"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-200";
      case "in-progress":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "pending":
        return "bg-red-100 text-red-800 border-red-200";
      case "scheduled":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "Completada";
      case "in-progress":
        return "En Progreso";
      case "pending":
        return "Pendiente";
      case "scheduled":
        return "Programada";
      default:
        return "Desconocido";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "border-l-red-500";
      case "medium":
        return "border-l-yellow-500";
      case "low":
        return "border-l-green-500";
      default:
        return "border-l-gray-500";
    }
  };

  const filteredCleanings = allCleanings.filter(cleaning =>
    cleaning.property.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cleaning.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cleaning.cleaner.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar por propiedad, dirección o limpiador..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Button variant="outline" className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Más Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Limpiezas */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-gray-900">
          Todas las Limpiezas ({filteredCleanings.length})
        </h3>

        {filteredCleanings.length === 0 ? (
          <Card className="border-0 shadow-md">
            <CardContent className="p-8 text-center">
              <p className="text-gray-500">No se encontraron limpiezas que coincidan con tu búsqueda.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredCleanings.map((cleaning) => (
              <Card key={cleaning.id} className={`border-0 shadow-md hover:shadow-lg transition-shadow border-l-4 ${getPriorityColor(cleaning.priority)}`}>
                <CardContent className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <h4 className="font-semibold text-gray-900">
                          {cleaning.property}
                        </h4>
                        <div className="flex gap-2">
                          <Badge variant="outline" className="text-xs">
                            {cleaning.date}
                          </Badge>
                          <Badge className={getStatusColor(cleaning.status)}>
                            {getStatusText(cleaning.status)}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {cleaning.address}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {cleaning.time}
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {cleaning.cleaner}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end">
                      {cleaning.status === "pending" && (
                        <Button size="sm" variant="outline">
                          Asignar
                        </Button>
                      )}
                      
                      {cleaning.status === "in-progress" && (
                        <Button size="sm" className="bg-green-600 hover:bg-green-700">
                          Completar
                        </Button>
                      )}

                      <Button size="sm" variant="ghost">
                        Ver Detalles
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CleaningList;
