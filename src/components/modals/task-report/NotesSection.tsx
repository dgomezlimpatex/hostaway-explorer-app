
import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';

interface NotesSectionProps {
  notes: string;
  onNotesChange: (notes: string) => void;
}

export const NotesSection: React.FC<NotesSectionProps> = ({
  notes,
  onNotesChange,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <FileText className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Notas Generales</h3>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-md">Observaciones y Comentarios</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Escribe aquí cualquier observación adicional sobre la limpieza, el estado de la propiedad, o comentarios para el supervisor..."
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            className="min-h-[200px]"
          />
          <p className="text-sm text-gray-500 mt-2">
            Estas notas serán incluidas en el reporte final y pueden ser útiles para futuras limpiezas.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-md">Sugerencias de Mejora</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="p-3 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-1">Productos de limpieza</h4>
              <p className="text-sm text-blue-700">
                ¿Hay algún producto específico que funcione mejor para esta propiedad?
              </p>
            </div>
            
            <div className="p-3 bg-green-50 rounded-lg">
              <h4 className="font-medium text-green-900 mb-1">Tiempo de limpieza</h4>
              <p className="text-sm text-green-700">
                ¿El tiempo asignado fue adecuado o necesitas más/menos tiempo?
              </p>
            </div>
            
            <div className="p-3 bg-purple-50 rounded-lg">
              <h4 className="font-medium text-purple-900 mb-1">Acceso y llaves</h4>
              <p className="text-sm text-purple-700">
                ¿Hubo algún problema con el acceso a la propiedad?
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
