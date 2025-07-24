import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bed, Bath, Clock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface PropertyDetailsSectionProps {
  propertyData: any;
}

export const PropertyDetailsSection = ({ propertyData }: PropertyDetailsSectionProps) => {
  const { userRole } = useAuth();
  if (!propertyData) return null;

  return (
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
          
          {/* Ocultar coste para cleaners */}
          {userRole !== 'cleaner' && (
            <div className="flex flex-col items-center p-3 bg-amber-50 rounded-lg border border-amber-200">
              <span className="text-xl mb-1">💰</span>
              <span className="text-sm text-gray-600">Coste</span>
              <span className="text-lg font-semibold text-amber-800">{propertyData.coste_servicio}€</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};