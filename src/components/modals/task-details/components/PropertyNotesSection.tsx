import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Info } from 'lucide-react';

interface PropertyNotesSectionProps {
  propertyData: any;
}

export const PropertyNotesSection = ({ propertyData }: PropertyNotesSectionProps) => {
  if (!propertyData?.notas) return null;

  return (
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
  );
};