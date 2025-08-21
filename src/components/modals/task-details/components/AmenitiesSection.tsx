import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shirt, Coffee } from 'lucide-react';

interface AmenitiesSectionProps {
  propertyData: any;
}

export const AmenitiesSection = ({ propertyData }: AmenitiesSectionProps) => {
  if (!propertyData) return null;

  return (
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
            <span className="text-sm text-gray-700">Sábanas Grandes</span>
            <Badge variant="outline" className="bg-white">{propertyData.numero_sabanas || 0}</Badge>
          </div>

          {propertyData.numero_sabanas_pequenas > 0 && (
            <div className="flex items-center justify-between p-2 bg-red-50 rounded border border-red-200">
              <span className="text-sm text-gray-700">Sábanas Pequeñas</span>
              <Badge variant="outline" className="bg-white">{propertyData.numero_sabanas_pequenas}</Badge>
            </div>
          )}

          {propertyData.numero_sabanas_suite > 0 && (
            <div className="flex items-center justify-between p-2 bg-indigo-50 rounded border border-indigo-200">
              <span className="text-sm text-gray-700">Sábanas Suite</span>
              <Badge variant="outline" className="bg-white">{propertyData.numero_sabanas_suite}</Badge>
            </div>
          )}
          
          <div className="flex items-center justify-between p-2 bg-cyan-50 rounded border border-cyan-200">
            <span className="text-sm text-gray-700">Toallas Grandes</span>
            <Badge variant="outline" className="bg-white">{propertyData.numero_toallas_grandes || 0}</Badge>
          </div>
          
          <div className="flex items-center justify-between p-2 bg-teal-50 rounded border border-teal-200">
            <span className="text-sm text-gray-700">Toallas Pequeñas</span>
            <Badge variant="outline" className="bg-white">{propertyData.numero_toallas_pequenas || 0}</Badge>
          </div>
          
          <div className="flex items-center justify-between p-2 bg-rose-50 rounded border border-rose-200">
            <span className="text-sm text-gray-700">Alfombrines</span>
            <Badge variant="outline" className="bg-white">{propertyData.numero_alfombrines || 0}</Badge>
          </div>
          
          <div className="flex items-center justify-between p-2 bg-violet-50 rounded border border-violet-200">
            <span className="text-sm text-gray-700">Fundas Almohada</span>
            <Badge variant="outline" className="bg-white">{propertyData.numero_fundas_almohada || 0}</Badge>
          </div>
          
          <div className="flex items-center justify-between p-2 bg-emerald-50 rounded border border-emerald-200">
            <span className="text-sm text-gray-700 flex items-center gap-1">
              <Coffee className="h-3 w-3" />
              Kit Alimentario
            </span>
            <Badge variant="outline" className="bg-white">{propertyData.kit_alimentario || 0}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};