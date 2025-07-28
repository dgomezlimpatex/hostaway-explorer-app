import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Users,
  User,
  Play,
  Pause
} from 'lucide-react';
import { Task } from '@/types/calendar';
import { useGroupedTaskReport } from '@/hooks/useGroupedTaskReports';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

const formatTime = (timeString: string) => {
  return format(new Date(timeString), 'HH:mm');
};

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
};
import { TaskReportModal } from './TaskReportModal';

interface GroupedTaskReportModalProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const GroupedTaskReportModal: React.FC<GroupedTaskReportModalProps> = ({
  task,
  open,
  onOpenChange,
}) => {
  const { userRole } = useAuth();
  const { data: groupedReport, isLoading } = useGroupedTaskReport(task?.id || '');
  const [selectedReport, setSelectedReport] = useState<{ task: Task; reportId: string } | null>(null);

  if (!task) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'in_progress':
        return <Play className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'needs_review':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'in_progress':
        return 'default';
      case 'completed':
        return 'outline';
      case 'needs_review':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const calculateTotalDuration = () => {
    if (!groupedReport?.earliest_start_time || !groupedReport?.latest_end_time) {
      return null;
    }
    
    const start = new Date(groupedReport.earliest_start_time);
    const end = new Date(groupedReport.latest_end_time);
    const diffMs = end.getTime() - start.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    return formatDuration(diffMinutes);
  };

  const handleOpenIndividualReport = (reportInfo: any) => {
    setSelectedReport({
      task: {
        ...task,
        cleanerId: reportInfo.cleaner_id,
        cleaner: reportInfo.cleaner_name
      },
      reportId: reportInfo.id
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Reportes de la Tarea: {task.property}
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : !groupedReport ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay reportes disponibles para esta tarea.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Resumen General */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Resumen General</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">
                        {groupedReport.total_reports}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Total Reportes
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {groupedReport.completed_reports}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Completados
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {groupedReport.in_progress_reports}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        En Progreso
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {groupedReport.pending_reports}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Pendientes
                      </div>
                    </div>
                  </div>

                  {groupedReport.earliest_start_time && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="font-medium mb-2">Tiempo del Servicio</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Inicio:</span>
                          <div className="font-medium">
                            {formatTime(groupedReport.earliest_start_time)}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Fin:</span>
                          <div className="font-medium">
                            {groupedReport.latest_end_time 
                              ? formatTime(groupedReport.latest_end_time)
                              : "En curso"
                            }
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Duración:</span>
                          <div className="font-medium">
                            {calculateTotalDuration() || "En curso"}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Lista de Reportes Individuales */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Reportes por Trabajador</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {groupedReport.individual_reports.map((reportInfo) => (
                      <div
                        key={reportInfo.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <User className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{reportInfo.cleaner_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {reportInfo.start_time 
                                ? `Iniciado: ${formatTime(reportInfo.start_time)}`
                                : "No iniciado"
                              }
                              {reportInfo.end_time && (
                                <span> • Finalizado: {formatTime(reportInfo.end_time)}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <Badge 
                            variant={getStatusColor(reportInfo.overall_status) as any}
                            className="flex items-center gap-1"
                          >
                            {getStatusIcon(reportInfo.overall_status)}
                            {reportInfo.overall_status === 'pending' && 'Pendiente'}
                            {reportInfo.overall_status === 'in_progress' && 'En Progreso'}
                            {reportInfo.overall_status === 'completed' && 'Completado'}
                            {reportInfo.overall_status === 'needs_review' && 'Revisar'}
                          </Badge>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenIndividualReport(reportInfo)}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Ver Reporte
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal para reporte individual */}
      {selectedReport && (
        <TaskReportModal
          task={selectedReport.task}
          open={!!selectedReport}
          onOpenChange={(open) => {
            if (!open) setSelectedReport(null);
          }}
        />
      )}
    </>
  );
};