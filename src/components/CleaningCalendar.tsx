
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin, Clock, User, MoreVertical, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

const CleaningCalendar = () => {
  const [currentWeek, setCurrentWeek] = useState(0);

  // Generar días de la semana actual
  const generateWeekDays = () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + (currentWeek * 7));
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const weekDays = generateWeekDays();
  const today = new Date().toDateString();

  // Datos simulados de limpiezas por día
  const cleaningsByDay = {
    [weekDays[0].toDateString()]: [
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
        property: "Estudio Malasaña",
        address: "Calle Fuencarral 78",
        time: "13:00 - 15:00",
        checkOut: "12:00",
        checkIn: "16:00",
        cleaner: "Ana López",
        status: "pending",
        type: "maintenance"
      }
    ],
    [weekDays[1].toDateString()]: [
      {
        id: 3,
        property: "Villa Costa del Sol",
        address: "Av. Marítima 45",
        time: "09:00 - 12:00",
        checkOut: "11:00",
        checkIn: "16:00",
        cleaner: "Carlos Ruiz",
        status: "in-progress",
        type: "checkout-checkin"
      },
      {
        id: 4,
        property: "Apartamento Retiro",
        address: "Plaza del Retiro 12",
        time: "14:00 - 16:30",
        checkOut: "12:00",
        checkIn: "18:00",
        cleaner: "Sin asignar",
        status: "pending",
        type: "checkout-checkin"
      },
      {
        id: 5,
        property: "Loft Chueca",
        address: "Calle Hortaleza 89",
        time: "17:00 - 19:00",
        checkOut: "11:00",
        checkIn: "20:00",
        cleaner: "María García",
        status: "pending",
        type: "maintenance"
      }
    ],
    [weekDays[2].toDateString()]: [
      {
        id: 6,
        property: "Penthouse Salamanca",
        address: "Calle Serrano 200",
        time: "10:30 - 14:00",
        checkOut: "11:00",
        checkIn: "16:00",
        cleaner: "Ana López",
        status: "completed",
        type: "checkout-checkin"
      }
    ],
    [weekDays[5].toDateString()]: [
      {
        id: 7,
        property: "Casa Moncloa",
        address: "Avenida Complutense 45",
        time: "09:00 - 13:00",
        checkOut: "10:00",
        checkIn: "17:00",
        cleaner: "Carlos Ruiz",
        status: "pending",
        type: "checkout-checkin"
      },
      {
        id: 8,
        property: "Apartamento Chamberí",
        address: "Calle Arapiles 67",
        time: "15:00 - 17:30",
        checkOut: "12:00",
        checkIn: "19:00",
        cleaner: "María García",
        status: "pending",
        type: "maintenance"
      }
    ]
  };

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

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-ES', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short' 
    });
  };

  const getDayCleaningsCount = (dayString: string) => {
    return cleaningsByDay[dayString]?.length || 0;
  };

  return (
    <div className="space-y-6">
      {/* Navegación de semana */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-xl font-semibold text-gray-900">
            Calendario Semanal
          </h3>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setCurrentWeek(prev => prev - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-600 px-3">
              {weekDays[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} - {weekDays[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
            </span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setCurrentWeek(prev => prev + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
          Nueva Limpieza
        </Button>
      </div>

      {/* Calendario horizontal */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
        {weekDays.map((day, index) => {
          const dayString = day.toDateString();
          const dayCleanings = cleaningsByDay[dayString] || [];
          const isToday = dayString === today;
          
          return (
            <Card key={index} className={`border-0 shadow-md ${isToday ? 'ring-2 ring-blue-500' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className={`text-sm ${isToday ? 'text-blue-600 font-bold' : 'text-gray-600'}`}>
                    {formatDate(day)}
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {getDayCleaningsCount(dayString)}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="p-4 pt-0">
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {dayCleanings.length === 0 ? (
                      <div className="text-center text-gray-400 text-sm py-8">
                        Sin limpiezas
                      </div>
                    ) : (
                      dayCleanings.map((cleaning) => (
                        <Card key={cleaning.id} className="border border-gray-200 hover:shadow-md transition-shadow">
                          <CardContent className="p-3">
                            <div className="space-y-2">
                              <div className="flex items-start justify-between">
                                <h4 className="font-medium text-gray-900 text-sm leading-tight">
                                  {cleaning.property}
                                </h4>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                  <MoreVertical className="h-3 w-3" />
                                </Button>
                              </div>

                              <div className="flex items-center gap-1 text-gray-600 text-xs">
                                <MapPin className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{cleaning.address}</span>
                              </div>

                              <div className="space-y-1 text-xs">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3 text-blue-600 flex-shrink-0" />
                                  <span className="font-medium">{cleaning.time}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-red-600">Out: {cleaning.checkOut}</span>
                                  <span className="text-green-600">In: {cleaning.checkIn}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 text-xs">
                                <User className="h-3 w-3 text-gray-600 flex-shrink-0" />
                                <span className="truncate">{cleaning.cleaner}</span>
                              </div>

                              <div className="flex flex-col gap-2">
                                <Badge className={`${getStatusColor(cleaning.status)} text-xs`}>
                                  {getStatusText(cleaning.status)}
                                </Badge>
                                
                                {cleaning.status === "pending" && (
                                  <Button size="sm" variant="outline" className="h-7 text-xs">
                                    Asignar
                                  </Button>
                                )}
                                
                                {cleaning.status === "in-progress" && (
                                  <Button size="sm" className="bg-green-600 hover:bg-green-700 h-7 text-xs">
                                    Completar
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default CleaningCalendar;
