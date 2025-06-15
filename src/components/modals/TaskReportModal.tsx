
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Task } from '@/types/calendar';
import { TaskReport, ChecklistCategory } from '@/types/taskReports';
import { useTaskReport, useChecklistTemplates, useTaskReports } from '@/hooks/useTaskReports';
import { useAuth } from '@/hooks/useAuth';
import { ChecklistSection } from './task-report/ChecklistSection';
import { IssuesSection } from './task-report/IssuesSection';
import { NotesSection } from './task-report/NotesSection';
import { ReportSummary } from './task-report/ReportSummary';
import { useToast } from '@/hooks/use-toast';

interface TaskReportModalProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TaskReportModal: React.FC<TaskReportModalProps> = ({
  task,
  open,
  onOpenChange,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('checklist');
  const [checklist, setChecklist] = useState<Record<string, any>>({});
  const [issues, setIssues] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [reportStatus, setReportStatus] = useState<'pending' | 'in_progress' | 'completed' | 'needs_review'>('pending');

  const { data: existingReport, isLoading: isLoadingReport } = useTaskReport(task?.id || '');
  const { data: templates } = useChecklistTemplates();
  const { createReport, updateReport, isCreatingReport, isUpdatingReport } = useTaskReports();

  // Buscar plantilla apropiada para el tipo de propiedad
  const template = templates?.find(t => 
    task?.type && t.property_type.toLowerCase() === task.type.toLowerCase()
  ) || templates?.[0]; // Fallback a la primera plantilla disponible

  useEffect(() => {
    if (existingReport) {
      setChecklist(existingReport.checklist_completed || {});
      setIssues(existingReport.issues_found || []);
      setNotes(existingReport.notes || '');
      setReportStatus(existingReport.overall_status);
    } else {
      // Reset para nueva tarea
      setChecklist({});
      setIssues([]);
      setNotes('');
      setReportStatus('pending');
    }
  }, [existingReport, task]);

  const handleStartReport = () => {
    if (!task || !user) return;

    const reportData = {
      task_id: task.id,
      cleaner_id: user.id,
      checklist_template_id: template?.id,
      overall_status: 'in_progress' as const,
      start_time: new Date().toISOString(),
      checklist_completed: {},
      issues_found: [],
    };

    createReport(reportData);
    setReportStatus('in_progress');
  };

  const handleSaveProgress = () => {
    if (!existingReport) return;

    const updates = {
      checklist_completed: checklist,
      issues_found: issues,
      notes,
      overall_status: reportStatus,
    };

    updateReport({ reportId: existingReport.id, updates });
  };

  const handleCompleteReport = () => {
    if (!existingReport) return;

    const updates = {
      checklist_completed: checklist,
      issues_found: issues,
      notes,
      overall_status: 'completed' as const,
      end_time: new Date().toISOString(),
    };

    updateReport({ reportId: existingReport.id, updates });
    toast({
      title: "Reporte completado",
      description: "El reporte se ha completado exitosamente.",
    });
    onOpenChange(false);
  };

  const getCompletionPercentage = () => {
    if (!template?.checklist_items) return 0;
    
    const totalItems = template.checklist_items.reduce(
      (acc, category) => acc + category.items.length, 
      0
    );
    const completedItems = Object.keys(checklist).length;
    
    return totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  };

  const canComplete = () => {
    const percentage = getCompletionPercentage();
    return percentage >= 80; // Requiere al menos 80% completado
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Reporte de Tarea - {task.property}</span>
            <div className="flex items-center space-x-2">
              <Badge variant={reportStatus === 'completed' ? 'default' : 'secondary'}>
                {reportStatus === 'pending' && 'Pendiente'}
                {reportStatus === 'in_progress' && 'En Progreso'}
                {reportStatus === 'completed' && 'Completado'}
                {reportStatus === 'needs_review' && 'Necesita Revisión'}
              </Badge>
              {reportStatus === 'in_progress' && (
                <Badge variant="outline">
                  {getCompletionPercentage()}% Completado
                </Badge>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {isLoadingReport ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Clock className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p>Cargando reporte...</p>
              </div>
            </div>
          ) : !existingReport && reportStatus === 'pending' ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
              <h3 className="text-xl font-semibold">Iniciar Reporte de Tarea</h3>
              <p className="text-gray-600 text-center max-w-md">
                Comienza a documentar tu trabajo en esta propiedad. 
                Podrás tomar fotos, completar el checklist y reportar cualquier incidencia.
              </p>
              <Button 
                onClick={handleStartReport} 
                disabled={isCreatingReport}
                size="lg"
              >
                {isCreatingReport ? 'Iniciando...' : 'Iniciar Reporte'}
              </Button>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="checklist">Checklist</TabsTrigger>
                <TabsTrigger value="issues">Incidencias</TabsTrigger>
                <TabsTrigger value="notes">Notas</TabsTrigger>
                <TabsTrigger value="summary">Resumen</TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-auto">
                <TabsContent value="checklist" className="h-full">
                  <ChecklistSection
                    template={template}
                    checklist={checklist}
                    onChecklistChange={setChecklist}
                    reportId={existingReport?.id}
                  />
                </TabsContent>

                <TabsContent value="issues" className="h-full">
                  <IssuesSection
                    issues={issues}
                    onIssuesChange={setIssues}
                    reportId={existingReport?.id}
                  />
                </TabsContent>

                <TabsContent value="notes" className="h-full">
                  <NotesSection
                    notes={notes}
                    onNotesChange={setNotes}
                  />
                </TabsContent>

                <TabsContent value="summary" className="h-full">
                  <ReportSummary
                    task={task}
                    template={template}
                    checklist={checklist}
                    issues={issues}
                    notes={notes}
                    completionPercentage={getCompletionPercentage()}
                  />
                </TabsContent>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cerrar
                </Button>
                
                <div className="flex space-x-2">
                  {reportStatus === 'in_progress' && (
                    <>
                      <Button 
                        variant="secondary" 
                        onClick={handleSaveProgress}
                        disabled={isUpdatingReport}
                      >
                        {isUpdatingReport ? 'Guardando...' : 'Guardar Progreso'}
                      </Button>
                      
                      <Button 
                        onClick={handleCompleteReport}
                        disabled={!canComplete() || isUpdatingReport}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {isUpdatingReport ? 'Completando...' : 'Completar Reporte'}
                      </Button>
                    </>
                  )}
                  
                  {reportStatus === 'completed' && (
                    <Badge variant="default" className="px-4 py-2">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Reporte Completado
                    </Badge>
                  )}
                </div>
              </div>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
