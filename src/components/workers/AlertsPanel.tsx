import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AlertTriangle, 
  Clock, 
  Users, 
  CheckCircle, 
  XCircle,
  Info,
  Lightbulb
} from "lucide-react";
import { WorkerAlert } from '@/types/calendar';
import { useWorkerAlerts } from '@/hooks/useWorkerAlerts';
import { useCleaners } from '@/hooks/useCleaners';

interface AlertsPanelProps {
  className?: string;
}

export const AlertsPanel = ({ className }: AlertsPanelProps) => {
  const { 
    alerts, 
    criticalAlerts, 
    highAlerts, 
    mediumAlerts, 
    lowAlerts,
    totalAlerts,
    actionRequiredCount 
  } = useWorkerAlerts();
  
  const { cleaners } = useCleaners();
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);

  const getWorkerName = (cleanerId: string) => {
    const worker = cleaners.find(c => c.id === cleanerId);
    return worker?.name || 'Trabajador desconocido';
  };

  const getAlertIcon = (type: WorkerAlert['type']) => {
    switch (type) {
      case 'hours_exceeded':
        return <AlertTriangle className="h-4 w-4" />;
      case 'hours_deficit':
        return <Clock className="h-4 w-4" />;
      case 'vacation_pending':
        return <Users className="h-4 w-4" />;
      case 'schedule_conflict':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: WorkerAlert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'border-red-500 bg-red-50 text-red-800';
      case 'high':
        return 'border-orange-500 bg-orange-50 text-orange-800';
      case 'medium':
        return 'border-yellow-500 bg-yellow-50 text-yellow-800';
      case 'low':
        return 'border-blue-500 bg-blue-50 text-blue-800';
      default:
        return 'border-gray-500 bg-gray-50 text-gray-800';
    }
  };

  const getSeverityBadgeVariant = (severity: WorkerAlert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'destructive' as const;
      case 'high':
        return 'destructive' as const;
      case 'medium':
        return 'outline' as const;
      case 'low':
        return 'secondary' as const;
      default:
        return 'outline' as const;
    }
  };

  const dismissAlert = (alertIndex: number) => {
    setDismissedAlerts(prev => [...prev, alertIndex.toString()]);
  };

  const renderAlertsList = (alertsList: WorkerAlert[], title: string) => {
    const visibleAlerts = alertsList.filter((_, index) => 
      !dismissedAlerts.includes(index.toString())
    );

    if (visibleAlerts.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
          <p>No hay alertas {title.toLowerCase()}</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {visibleAlerts.map((alert, index) => (
          <Alert 
            key={index} 
            className={`${getSeverityColor(alert.severity)} border-l-4`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                {getAlertIcon(alert.type)}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">
                      {getWorkerName(alert.cleanerId)}
                    </span>
                    <Badge variant={getSeverityBadgeVariant(alert.severity)}>
                      {alert.severity.toUpperCase()}
                    </Badge>
                  </div>
                  <AlertDescription className="text-sm">
                    {alert.message}
                  </AlertDescription>
                  {alert.suggestedAction && (
                    <div className="mt-2 p-2 bg-white/50 rounded text-xs flex items-start gap-2">
                      <Lightbulb className="h-3 w-3 mt-0.5 text-yellow-600" />
                      <span><strong>Sugerencia:</strong> {alert.suggestedAction}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                {alert.actionRequired && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="text-xs h-6"
                  >
                    Resolver
                  </Button>
                )}
                <Button 
                  size="sm" 
                  variant="ghost"
                  className="text-xs h-6"
                  onClick={() => dismissAlert(index)}
                >
                  <XCircle className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </Alert>
        ))}
      </div>
    );
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Centro de Alertas
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline">
              {totalAlerts} alertas
            </Badge>
            {actionRequiredCount > 0 && (
              <Badge variant="destructive">
                {actionRequiredCount} requieren acción
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">
              Todas ({totalAlerts})
            </TabsTrigger>
            <TabsTrigger value="critical">
              Críticas ({criticalAlerts.length})
            </TabsTrigger>
            <TabsTrigger value="high">
              Altas ({highAlerts.length})
            </TabsTrigger>
            <TabsTrigger value="medium">
              Medias ({mediumAlerts.length})
            </TabsTrigger>
            <TabsTrigger value="low">
              Bajas ({lowAlerts.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="mt-4">
            {renderAlertsList(alerts, 'activas')}
          </TabsContent>
          
          <TabsContent value="critical" className="mt-4">
            {renderAlertsList(criticalAlerts, 'críticas')}
          </TabsContent>
          
          <TabsContent value="high" className="mt-4">
            {renderAlertsList(highAlerts, 'altas')}
          </TabsContent>
          
          <TabsContent value="medium" className="mt-4">
            {renderAlertsList(mediumAlerts, 'medias')}
          </TabsContent>
          
          <TabsContent value="low" className="mt-4">
            {renderAlertsList(lowAlerts, 'bajas')}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};