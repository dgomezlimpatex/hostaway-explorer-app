import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface WorkerScheduleCalendarProps {
  workerId: string;
}

export const WorkerScheduleCalendar = ({ workerId }: WorkerScheduleCalendarProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendario de Trabajo</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Calendario individual en desarrollo para el trabajador {workerId}</p>
      </CardContent>
    </Card>
  );
};