
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";
import { useState } from "react";

const CleaningCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Generar franjas horarias de 30 minutos desde las 6:00 hasta las 22:00
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 6; hour <= 22; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      if (hour < 22) {
        slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  // Trabajadores/Empleados de limpieza
  const cleaners = [
    "María García",
    "Ana López", 
    "Carlos Ruiz",
    "Jhoana Quintero",
    "Jaritza",
    "Lali Freire",
    "Katerine Samboni",
    "Thalia Martínez"
  ];

  // Datos simulados de limpiezas para el día actual
  const todayCleanings = [
    {
      id: 1,
      cleaner: "María García",
      property: "Blue Ocean Portonovo Studio 1°D",
      address: "Turquoise Apartments SL",
      startTime: "11:00",
      endTime: "13:30",
      type: "checkout-checkin",
      status: "pending",
      checkOut: "11:00",
      checkIn: "15:00"
    },
    {
      id: 2,
      cleaner: "Ana López",
      property: "Villa Costa del Sol",
      address: "Av. Marítima 45",
      startTime: "09:00",
      endTime: "12:00",
      type: "checkout-checkin",
      status: "in-progress",
      checkOut: "10:00",
      checkIn: "16:00"
    },
    {
      id: 3,
      cleaner: "Carlos Ruiz",
      property: "Apartamento Retiro Premium",
      address: "Plaza del Retiro 12",
      startTime: "14:00",
      endTime: "17:00",
      type: "maintenance",
      status: "pending",
      checkOut: "12:00",
      checkIn: "18:00"
    },
    {
      id: 4,
      cleaner: "Thalia Martínez",
      property: "Casas Coruña CB",
      address: "MOSTEIRO BRIBES",
      startTime: "16:00",
      endTime: "20:00",
      type: "checkout-checkin",
      status: "pending",
      checkOut: "16:00",
      checkIn: "21:00"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500";
      case "in-progress":
        return "bg-yellow-500";
      case "pending":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const getTaskPosition = (startTime: string, endTime: string) => {
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    const dayStartMinutes = 6 * 60; // 6:00 AM
    
    const leftPercent = ((startMinutes - dayStartMinutes) / (16 * 60)) * 100; // 16 horas de trabajo
    const widthPercent = ((endMinutes - startMinutes) / (16 * 60)) * 100;
    
    return { left: `${leftPercent}%`, width: `${widthPercent}%` };
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-ES', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long',
      year: 'numeric'
    });
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setDate(currentDate.getDate() - 1);
    } else {
      newDate.setDate(currentDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  return (
    <div className="space-y-6">
      {/* Header con navegación */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-xl font-semibold text-gray-900">
            Calendario Diario
          </h3>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigateDate('prev')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-600 px-3 min-w-[200px] text-center">
              {formatDate(currentDate)}
            </span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigateDate('next')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline">
            Hoy
          </Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
            Nueva Limpieza
          </Button>
        </div>
      </div>

      {/* Calendario horizontal */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="min-w-[1200px]">
              {/* Header de horas */}
              <div className="flex border-b bg-gray-50">
                <div className="w-48 flex-shrink-0 p-3 border-r bg-white">
                  <span className="font-medium text-gray-700">Trabajadores</span>
                </div>
                <div className="flex-1 flex">
                  {timeSlots.map((time, index) => (
                    <div 
                      key={time} 
                      className={`flex-1 p-2 text-center text-xs font-medium text-gray-600 border-r ${
                        time.endsWith(':00') ? 'bg-gray-100' : 'bg-gray-50'
                      }`}
                      style={{ minWidth: '50px' }}
                    >
                      {time.endsWith(':00') ? time : ''}
                    </div>
                  ))}
                </div>
              </div>

              {/* Filas de trabajadores */}
              <div className="relative">
                {cleaners.map((cleaner, cleanerIndex) => (
                  <div key={cleaner} className="flex border-b hover:bg-gray-50">
                    {/* Nombre del trabajador */}
                    <div className="w-48 flex-shrink-0 p-3 border-r bg-white">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-blue-600">
                            {cleaner.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {cleaner}
                        </span>
                      </div>
                    </div>

                    {/* Área de tareas con franjas horarias */}
                    <div className="flex-1 relative" style={{ height: '80px' }}>
                      {/* Líneas de separación horaria */}
                      {timeSlots.map((time, index) => (
                        <div 
                          key={`${cleaner}-${time}`}
                          className={`absolute top-0 bottom-0 border-r ${
                            time.endsWith(':00') ? 'border-gray-200' : 'border-gray-100'
                          }`}
                          style={{ 
                            left: `${(index / timeSlots.length) * 100}%`,
                            width: '1px'
                          }}
                        />
                      ))}

                      {/* Tareas de limpieza */}
                      {todayCleanings
                        .filter(cleaning => cleaning.cleaner === cleaner)
                        .map((cleaning) => {
                          const position = getTaskPosition(cleaning.startTime, cleaning.endTime);
                          return (
                            <div
                              key={cleaning.id}
                              className={`absolute top-2 bottom-2 ${getStatusColor(cleaning.status)} rounded-md p-2 text-white shadow-sm hover:shadow-md transition-shadow cursor-pointer`}
                              style={position}
                            >
                              <div className="text-xs font-medium truncate">
                                {cleaning.property}
                              </div>
                              <div className="text-xs opacity-90 truncate">
                                {cleaning.startTime} - {cleaning.endTime}
                              </div>
                              <div className="text-xs opacity-80 flex items-center gap-1 mt-1">
                                <Clock className="h-3 w-3" />
                                Out: {cleaning.checkOut} | In: {cleaning.checkIn}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leyenda */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-gray-600">Estado:</span>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded"></div>
          <span>Pendiente</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-yellow-500 rounded"></div>
          <span>En Progreso</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded"></div>
          <span>Completado</span>
        </div>
      </div>
    </div>
  );
};

export default CleaningCalendar;
