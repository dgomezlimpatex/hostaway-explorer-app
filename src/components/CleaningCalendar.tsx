
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, User, MoreVertical } from "lucide-react";
import { useState } from "react";

const CleaningCalendar = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().getDate());

  const cleanings = [
    {
      id: 1,
      property: "Apartamento Centro - 2A",
      address: "Calle Mayor 123",
      time: "10:00 - 12:00",
      checkOut: "10:00",
      checkIn: "15:00",
      cleaner: "María García",
      status: "completed",
      type: "checkout-checkin"
    },
    {
      id: 2,
      property: "Villa Costa del Sol",
      address: "Av. Marítima 45",
      time: "13:00 - 16:00",
      checkOut: "11:00",
      checkIn: "16:00",
      cleaner: "Ana López",
      status: "in-progress",
      type: "checkout-checkin"
    },
    {
      id: 3,
      property: "Estudio Malasaña",
      address: "Calle Fuencarral 78",
      time: "16:30 - 18:00",
      checkOut: "12:00",
      checkIn: "20:00",
      cleaner: "Sin asignar",
      status: "pending",
      type: "maintenance"
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
      default:
        return "Desconocido";
    }
  };

  // Generar días del mes actual para el mini calendario
  const generateCalendarDays = () => {
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
    
    const days = [];
    
    // Días vacíos al inicio
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    
    // Días del mes
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };

  const calendarDays = generateCalendarDays();
  const today = new Date().getDate();

  return (
    <div className="grid lg:grid-cols-4 gap-6">
      {/* Mini Calendario */}
      <Card className="lg:col-span-1 border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Diciembre 2024</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-sm">
            {["D", "L", "M", "X", "J", "V", "S"].map((day) => (
              <div key={day} className="p-2 font-medium text-gray-500">
                {day}
              </div>
            ))}
            {calendarDays.map((day, index) => (
              <button
                key={index}
                onClick={() => day && setSelectedDate(day)}
                className={`p-2 rounded-lg transition-colors ${
                  day === null
                    ? ""
                    : day === today
                    ? "bg-blue-600 text-white"
                    : day === selectedDate
                    ? "bg-blue-100 text-blue-800"
                    : "hover:bg-gray-100"
                }`}
                disabled={day === null}
              >
                {day}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lista de Limpiezas */}
      <div className="lg:col-span-3 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900">
            Limpiezas del {selectedDate} de Diciembre
          </h3>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
            Nueva Limpieza
          </Button>
        </div>

        <div className="space-y-4">
          {cleanings.map((cleaning) => (
            <Card key={cleaning.id} className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-900 text-lg">
                          {cleaning.property}
                        </h4>
                        <div className="flex items-center gap-1 text-gray-600 text-sm mt-1">
                          <MapPin className="h-4 w-4" />
                          {cleaning.address}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">Limpieza:</span>
                        <span>{cleaning.time}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Check-out:</span>
                        <span className="text-red-600">{cleaning.checkOut}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Check-in:</span>
                        <span className="text-green-600">{cleaning.checkIn}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-600" />
                      <span className="text-sm">
                        <span className="font-medium">Limpiador:</span> {cleaning.cleaner}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:items-end gap-2">
                    <Badge className={getStatusColor(cleaning.status)}>
                      {getStatusText(cleaning.status)}
                    </Badge>
                    
                    {cleaning.status === "pending" && (
                      <Button size="sm" variant="outline">
                        Asignar
                      </Button>
                    )}
                    
                    {cleaning.status === "in-progress" && (
                      <Button size="sm" className="bg-green-600 hover:bg-green-700">
                        Marcar Completada
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CleaningCalendar;
