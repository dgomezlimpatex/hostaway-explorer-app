
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Property } from '@/types/property';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  MapPin, 
  Bed, 
  Bath, 
  Clock, 
  Euro,
  FileText,
  Home,
  User,
  Calendar
} from 'lucide-react';

interface EditPropertyModalProps {
  property: Property | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditPropertyModal: React.FC<EditPropertyModalProps> = ({
  property,
  open,
  onOpenChange,
}) => {
  const handleClose = () => {
    onOpenChange(false);
  };

  // Don't render if property is null
  if (!property) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <Home className="h-6 w-6 text-blue-600" />
            {property.nombre}
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-sm">
              {property.codigo}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Información Básica */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              Información Básica
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Nombre de la Propiedad</label>
                <p className="text-sm text-gray-900 mt-1 p-2 bg-white rounded border">
                  {property.nombre}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Código</label>
                <p className="text-sm text-gray-900 mt-1 p-2 bg-white rounded border">
                  {property.codigo}
                </p>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  Dirección
                </label>
                <p className="text-sm text-gray-900 mt-1 p-2 bg-white rounded border">
                  {property.direccion}
                </p>
              </div>
            </div>
          </div>

          {/* Características */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-lg border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Home className="h-5 w-5 text-green-600" />
              Características
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-white rounded-lg border">
                <Bed className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">{property.numeroCamas}</p>
                <p className="text-sm text-gray-600">Camas</p>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border">
                <Bath className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">{property.numeroBanos}</p>
                <p className="text-sm text-gray-600">Baños</p>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border">
                <Clock className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">{property.duracionServicio}</p>
                <p className="text-sm text-gray-600">Minutos</p>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border">
                <Euro className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">€{property.costeServicio}</p>
                <p className="text-sm text-gray-600">Coste</p>
              </div>
            </div>
          </div>

          {/* Horarios */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-lg border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-600" />
              Horarios Predeterminados
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Check-in</label>
                <p className="text-sm text-gray-900 mt-1 p-2 bg-white rounded border">
                  {property.checkInPredeterminado}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Check-out</label>
                <p className="text-sm text-gray-900 mt-1 p-2 bg-white rounded border">
                  {property.checkOutPredeterminado}
                </p>
              </div>
            </div>
          </div>

          {/* Textiles */}
          <div className="bg-gradient-to-r from-yellow-50 to-amber-50 p-6 rounded-lg border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Inventario de Textiles
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-white rounded-lg border">
                <p className="text-xl font-bold text-gray-900">{property.numeroSabanas}</p>
                <p className="text-sm text-gray-600">Sábanas</p>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border">
                <p className="text-xl font-bold text-gray-900">{property.numeroToallasGrandes}</p>
                <p className="text-sm text-gray-600">Toallas Grandes</p>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border">
                <p className="text-xl font-bold text-gray-900">{property.numeroTotallasPequenas}</p>
                <p className="text-sm text-gray-600">Toallas Pequeñas</p>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border">
                <p className="text-xl font-bold text-gray-900">{property.numeroAlfombrines}</p>
                <p className="text-sm text-gray-600">Alfombrines</p>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border md:col-span-2">
                <p className="text-xl font-bold text-gray-900">{property.numeroFundasAlmohada}</p>
                <p className="text-sm text-gray-600">Fundas de Almohada</p>
              </div>
            </div>
          </div>

          {/* Notas */}
          {property.notas && (
            <div className="bg-gradient-to-r from-gray-50 to-slate-50 p-6 rounded-lg border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-gray-600" />
                Notas Adicionales
              </h3>
              <div className="bg-white p-4 rounded-lg border">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{property.notas}</p>
              </div>
            </div>
          )}
        </div>

        <Separator className="my-6" />
        
        <div className="flex justify-end">
          <Button onClick={handleClose} className="px-6">
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
