import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface WorkerTimeTrackingProps {
  workerId: string;
}

export const WorkerTimeTracking = ({ workerId }: WorkerTimeTrackingProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Control de Tiempo</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Funcionalidad en desarrollo para el trabajador {workerId}</p>
      </CardContent>
    </Card>
  );
};