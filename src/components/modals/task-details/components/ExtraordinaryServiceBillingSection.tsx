import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Mail, Phone, MapPin, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Task } from '@/types/calendar';

interface ExtraordinaryServiceBillingSectionProps {
  task: Task;
}

export const ExtraordinaryServiceBillingSection = ({ task }: ExtraordinaryServiceBillingSectionProps) => {
  const { userRole } = useAuth();
  
  // Only show to admin and managers
  if (userRole !== 'admin' && userRole !== 'manager') {
    return null;
  }

  // Only show for extraordinary services that have billing data
  if (task.type !== 'trabajo-extraordinario' || !task.extraordinaryClientName) {
    return null;
  }

  return (
    <Card className="border-purple-200 bg-purple-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-purple-800">
          <CreditCard className="h-5 w-5" />
          Información de Facturación - Servicio Extraordinario
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Client Name */}
            <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-purple-200">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-gray-700">Cliente</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">
                {task.extraordinaryClientName}
              </span>
            </div>

            {/* Email */}
            {task.extraordinaryClientEmail && (
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-purple-200">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium text-gray-700">Email</span>
                </div>
                <span className="text-sm text-gray-900">
                  {task.extraordinaryClientEmail}
                </span>
              </div>
            )}

            {/* Phone */}
            {task.extraordinaryClientPhone && (
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-purple-200">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium text-gray-700">Teléfono</span>
                </div>
                <span className="text-sm text-gray-900">
                  {task.extraordinaryClientPhone}
                </span>
              </div>
            )}

            {/* Service Cost */}
            {task.cost && (
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-purple-200">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium text-gray-700">Coste del Servicio</span>
                </div>
                <Badge className="bg-green-100 text-green-800 border-green-300">
                  €{task.cost.toFixed(2)}
                </Badge>
              </div>
            )}
          </div>

          {/* Billing Address */}
          {task.extraordinaryBillingAddress && (
            <div className="p-3 bg-white rounded-lg border border-purple-200">
              <div className="flex items-start gap-2 mb-2">
                <MapPin className="h-4 w-4 text-purple-600 mt-0.5" />
                <span className="text-sm font-medium text-gray-700">Dirección de Facturación</span>
              </div>
              <p className="text-sm text-gray-900 ml-6">
                {task.extraordinaryBillingAddress}
              </p>
            </div>
          )}

          {/* Service Address for comparison */}
          <div className="p-3 bg-gray-50 rounded-lg border">
            <div className="flex items-start gap-2 mb-2">
              <MapPin className="h-4 w-4 text-gray-600 mt-0.5" />
              <span className="text-sm font-medium text-gray-700">Dirección del Servicio</span>
            </div>
            <p className="text-sm text-gray-900 ml-6">
              {task.address}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};