import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Cleaner } from '@/types/calendar';

interface WorkerBasicInfoProps {
  worker: Cleaner;
}

export const WorkerBasicInfo = ({ worker }: WorkerBasicInfoProps) => {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Información Personal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nombre</Label>
              <Input value={worker.name} readOnly />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={worker.email || ''} readOnly />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input value={worker.telefono || ''} readOnly />
            </div>
            <div>
              <Label>Contacto Emergencia</Label>
              <Input value={worker.emergencyContactName || ''} readOnly />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};