import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User } from 'lucide-react';

interface ClientInfoSectionProps {
  clientData: any;
}

export const ClientInfoSection = ({ clientData }: ClientInfoSectionProps) => {
  if (!clientData) return null;

  return (
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
  );
};