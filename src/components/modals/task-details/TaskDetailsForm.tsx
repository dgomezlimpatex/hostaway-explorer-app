import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Task } from "@/types/calendar";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Home, 
  MapPin, 
  Clock, 
  User, 
  Bed, 
  Bath, 
  Shirt, 
  Coffee,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Info
} from "lucide-react";
interface TaskDetailsFormProps {
  task: Task;
  isEditing: boolean;
  formData: Partial<Task>;
  onFieldChange: (field: string, value: string) => void;
}
export const TaskDetailsForm = ({
  task,
  isEditing,
  formData,
  onFieldChange
}: TaskDetailsFormProps) => {
  const [propertyData, setPropertyData] = useState<any>(null);
  const [clientData, setClientData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPropertyAndClientInfo = async () => {
      if (task.propertyId) {
        try {
          // Fetch complete property information
          const { data: property } = await supabase
            .from('properties')
            .select(`
              *,
              clients!inner(*)
            `)
            .eq('id', task.propertyId)
            .maybeSingle();

          if (property) {
            setPropertyData(property);
            setClientData(property.clients);
          }
        } catch (error) {
          console.error('Error fetching property data:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    fetchPropertyAndClientInfo();
  }, [task.propertyId]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle2 className="h-3 w-3 mr-1" />Completado</Badge>;
      case 'in-progress':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-300"><Clock className="h-3 w-3 mr-1" />En Progreso</Badge>;
      case 'pending':
        return <Badge className="bg-red-100 text-red-800 border-red-300"><AlertCircle className="h-3 w-3 mr-1" />Pendiente</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-gray-200 rounded-lg"></div>
          <div className="h-32 bg-gray-200 rounded-lg"></div>
          <div className="h-24 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card con información principal */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Home className="h-5 w-5 text-blue-600" />
              {isEditing ? (
                <Input 
                  value={formData.property || ''} 
                  onChange={e => onFieldChange('property', e.target.value)}
                  className="text-lg font-semibold"
                />
              ) : (
                task.property
              )}
            </CardTitle>
            {getStatusBadge(task.status)}
          </div>
          {propertyData?.codigo && (
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <Info className="h-4 w-4" />
              <span className="font-medium">Código: {propertyData.codigo}</span>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-gray-600">
            <MapPin className="h-4 w-4" />
            {isEditing ? (
              <Input 
                value={formData.address || ''} 
                onChange={e => onFieldChange('address', e.target.value)}
                placeholder="Dirección"
              />
            ) : (
              <span>{task.address}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Horarios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-5 w-5 text-purple-600" />
            Horarios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Hora de Inicio</Label>
              {isEditing ? (
                <Input 
                  type="time" 
                  value={formData.startTime || ''} 
                  onChange={e => onFieldChange('startTime', e.target.value)}
                />
              ) : (
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <span className="text-purple-800 font-medium">{task.startTime}</span>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Hora de Fin</Label>
              {isEditing ? (
                <Input 
                  type="time" 
                  value={formData.endTime || ''} 
                  onChange={e => onFieldChange('endTime', e.target.value)}
                />
              ) : (
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <span className="text-purple-800 font-medium">{task.endTime}</span>
                </div>
              )}
            </div>
          </div>
          
          {propertyData && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Check-in Predeterminado</Label>
                <div className="p-3 bg-gray-50 rounded-lg border">
                  <span className="text-gray-700">{propertyData.check_in_predeterminado}</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Check-out Predeterminado</Label>
                <div className="p-3 bg-gray-50 rounded-lg border">
                  <span className="text-gray-700">{propertyData.check_out_predeterminado}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Información de la Propiedad */}
      {propertyData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bed className="h-5 w-5 text-green-600" />
              Características de la Propiedad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="flex flex-col items-center p-3 bg-green-50 rounded-lg border border-green-200">
                <Bed className="h-6 w-6 text-green-600 mb-1" />
                <span className="text-sm text-gray-600">Camas</span>
                <span className="text-lg font-semibold text-green-800">{propertyData.numero_camas}</span>
              </div>
              
              <div className="flex flex-col items-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                <Bath className="h-6 w-6 text-blue-600 mb-1" />
                <span className="text-sm text-gray-600">Baños</span>
                <span className="text-lg font-semibold text-blue-800">{propertyData.numero_banos}</span>
              </div>
              
              <div className="flex flex-col items-center p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                <Clock className="h-6 w-6 text-indigo-600 mb-1" />
                <span className="text-sm text-gray-600">Duración</span>
                <span className="text-lg font-semibold text-indigo-800">{propertyData.duracion_servicio}min</span>
              </div>
              
              <div className="flex flex-col items-center p-3 bg-amber-50 rounded-lg border border-amber-200">
                <span className="text-xl mb-1">💰</span>
                <span className="text-sm text-gray-600">Coste</span>
                <span className="text-lg font-semibold text-amber-800">{propertyData.coste_servicio}€</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Amenities y Textiles */}
      {propertyData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shirt className="h-5 w-5 text-orange-600" />
              Amenities y Textiles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="flex items-center justify-between p-2 bg-orange-50 rounded border border-orange-200">
                <span className="text-sm text-gray-700">Sábanas</span>
                <Badge variant="outline" className="bg-white">{propertyData.numero_sabanas}</Badge>
              </div>
              
              <div className="flex items-center justify-between p-2 bg-cyan-50 rounded border border-cyan-200">
                <span className="text-sm text-gray-700">Toallas Grandes</span>
                <Badge variant="outline" className="bg-white">{propertyData.numero_toallas_grandes}</Badge>
              </div>
              
              <div className="flex items-center justify-between p-2 bg-teal-50 rounded border border-teal-200">
                <span className="text-sm text-gray-700">Toallas Pequeñas</span>
                <Badge variant="outline" className="bg-white">{propertyData.numero_toallas_pequenas}</Badge>
              </div>
              
              <div className="flex items-center justify-between p-2 bg-rose-50 rounded border border-rose-200">
                <span className="text-sm text-gray-700">Alfombrines</span>
                <Badge variant="outline" className="bg-white">{propertyData.numero_alfombrines}</Badge>
              </div>
              
              <div className="flex items-center justify-between p-2 bg-violet-50 rounded border border-violet-200">
                <span className="text-sm text-gray-700">Fundas Almohada</span>
                <Badge variant="outline" className="bg-white">{propertyData.numero_fundas_almohada}</Badge>
              </div>
              
              <div className="flex items-center justify-between p-2 bg-emerald-50 rounded border border-emerald-200">
                <span className="text-sm text-gray-700 flex items-center gap-1">
                  <Coffee className="h-3 w-3" />
                  Kit Alimentario
                </span>
                <Badge variant="outline" className="bg-white">{propertyData.kit_alimentario}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Información del Cliente */}
      {clientData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-5 w-5 text-blue-600" />
              Información del Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                <span className="text-sm font-medium text-gray-700">Tipo de Servicio</span>
                <Badge className="bg-blue-100 text-blue-800 border-blue-300 capitalize">
                  {clientData.tipo_servicio}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                <span className="text-sm font-medium text-gray-700">Método de Pago</span>
                <span className="text-sm text-gray-600 capitalize">{clientData.metodo_pago}</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                <span className="text-sm font-medium text-gray-700">Supervisor</span>
                <span className="text-sm text-gray-600">{clientData.supervisor}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status y Estado (solo en modo edición) */}
      {isEditing && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-5 w-5 text-gray-600" />
              Estado de la Tarea
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Estado</Label>
              <Select value={formData.status} onValueChange={value => onFieldChange('status', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="in-progress">En Progreso</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notas de la propiedad */}
      {propertyData?.notas && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-5 w-5 text-gray-600" />
              Notas Especiales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-sm text-gray-700">{propertyData.notas}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};