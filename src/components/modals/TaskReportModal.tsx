
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Clock, Save, FileText, AlertTriangle, Camera, CheckSquare } from 'lucide-react';
import { Task } from '@/types/calendar';
import { TaskReport, TaskChecklistTemplate } from '@/types/taskReports';
import { useTaskReports, useTaskReport, useChecklistTemplates } from '@/hooks/useTaskReports';
import { useToast } from '@/hooks/use-toast';
import { ChecklistSection } from './task-report/ChecklistSection';
import { MediaCapture } from './task-report/MediaCapture';
import { IssuesSection } from './task-report/IssuesSection';
import { NotesSection } from './task-report/NotesSection';
import { ReportSummary } from './task-report/ReportSummary';

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
  const { toast } = useToast();
  const { createReport, updateReport, isCreatingReport, isUpdatingReport } = useTaskReports();
  const { data: existingReport, isLoading: isLoadingReport } = useTaskReport(task?.id || '');
  const { data: templates, isLoading: isLoadingTemplates } = useChecklistTemplates();

  const [currentReport, setCurrentReport] = useState<TaskReport | null>(null);
  const [checklist, setChecklist] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState('');
  const [issues, setIssues] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('checklist');
  const [currentTemplate, setCurrentTemplate] = useState<TaskChecklistTemplate | undefined>();

  // Initialize report data when modal opens
  useEffect(() => {
    if (open && task) {
      console.log('TaskReportModal - initializing for task:', task.id);
      
      if (existingReport) {
        console.log('TaskReportModal - loading existing report:', existingReport);
        setCurrentReport(existingReport);
        setChecklist(existingReport.checklist_completed || {});
        setNotes(existingReport.notes || '');
        setIssues(existingReport.issues_found || []);
      } else {
        console.log('TaskReportModal - creating new report');
        setCurrentReport(null);
        setChecklist({});
        setNotes('');
        setIssues([]);
      }

      // Find appropriate template based on property type or default
      if (templates && templates.length > 0) {
        // Try to match by property type first, fallback to first template
        const template = templates.find(t => 
          task.type?.toLowerCase().includes(t.property_type?.toLowerCase())
        ) || templates[0];
        
        console.log('TaskReportModal - selected template:', template);
        setCurrentTemplate(template);
      }
    }
  }, [open, task, existingReport, templates]);

  // Calculate completion percentage
  const completionPercentage = React.useMemo(() => {
    if (!currentTemplate) return 0;
    
    const totalItems = currentTemplate.checklist_items?.reduce(
      (acc, category) => acc + category.items.length, 
      0
    ) || 0;
    
    const completedItems = Object.keys(checklist).length;
    
    return totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  }, [checklist, currentTemplate]);

  const handleSave = async () => {
    if (!task) return;

    const reportData = {
      task_id: task.id,
      checklist_template_id: currentTemplate?.id,
      checklist_completed: checklist,
      notes,
      issues_found: issues,
      overall_status: completionPercentage >= 80 ? 'completed' as const : 'in_progress' as const,
    };

    try {
      if (currentReport) {
        console.log('TaskReportModal - updating report:', currentReport.id, reportData);
        updateReport({ 
          reportId: currentReport.id, 
          updates: reportData 
        });
      } else {
        console.log('TaskReportModal - creating new report:', reportData);
        createReport(reportData);
      }
    } catch (error) {
      console.error('Error saving report:', error);
    }
  };

  const handleComplete = async () => {
    if (!task || completionPercentage < 80) {
      toast({
        title: "Reporte incompleto",
        description: "Completa al menos el 80% del checklist para finalizar el reporte.",
        variant: "destructive",
      });
      return;
    }

    const reportData = {
      task_id: task.id,
      checklist_template_id: currentTemplate?.id,
      checklist_completed: checklist,
      notes,
      issues_found: issues,
      overall_status: 'completed' as const,
      end_time: new Date().toISOString(),
    };

    try {
      if (currentReport) {
        updateReport({ 
          reportId: currentReport.id, 
          updates: reportData 
        });
      } else {
        createReport({
          ...reportData,
          start_time: new Date().toISOString(),
        });
      }
      
      toast({
        title: "Reporte completado",
        description: "El reporte se ha finalizado exitosamente.",
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error completing report:', error);
    }
  };

  if (!task) return null;

  const canComplete = completionPercentage >= 80;
  const reportStatus = currentReport?.overall_status || 'pending';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Reporte de Limpieza - {task.property}</span>
          </DialogTitle>
          <DialogDescription>
            {task.address} • {task.date} • {task.startTime} - {task.endTime}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Header */}
        <div className="border-b pb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Badge variant={reportStatus === 'completed' ? 'default' : 'secondary'}>
                {reportStatus === 'completed' ? 'Completado' : 
                 reportStatus === 'in_progress' ? 'En Progreso' : 'Pendiente'}
              </Badge>
              <span className="text-sm text-gray-600">
                {completionPercentage}% completado
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {isLoadingReport && (
                <span className="text-sm text-gray-500">Cargando...</span>
              )}
            </div>
          </div>
          <Progress value={completionPercentage} className="w-full" />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="checklist" className="flex items-center">
              <CheckSquare className="h-4 w-4 mr-2" />
              Checklist
            </TabsTrigger>
            <TabsTrigger value="issues" className="flex items-center">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Incidencias
              {issues.length > 0 && (
                <Badge variant="destructive" className="ml-2 text-xs">
                  {issues.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="notes" className="flex items-center">
              <FileText className="h-4 w-4 mr-2" />
              Notas
            </TabsTrigger>
            <TabsTrigger value="media" className="flex items-center">
              <Camera className="h-4 w-4 mr-2" />
              Fotos
            </TabsTrigger>
            <TabsTrigger value="summary" className="flex items-center">
              <CheckCircle className="h-4 w-4 mr-2" />
              Resumen
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto">
            <TabsContent value="checklist" className="space-y-4 h-full">
              {isLoadingTemplates ? (
                <div className="flex items-center justify-center py-8">
                  <Clock className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : (
                <ChecklistSection
                  template={currentTemplate}
                  checklist={checklist}
                  onChecklistChange={setChecklist}
                  reportId={currentReport?.id}
                />
              )}
            </TabsContent>

            <TabsContent value="issues" className="space-y-4 h-full">
              <IssuesSection
                issues={issues}
                onIssuesChange={setIssues}
                reportId={currentReport?.id}
              />
            </TabsContent>

            <TabsContent value="notes" className="space-y-4 h-full">
              <NotesSection
                notes={notes}
                onNotesChange={setNotes}
              />
            </TabsContent>

            <TabsContent value="media" className="space-y-4 h-full">
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Fotos y Videos</h3>
                <MediaCapture
                  onMediaCaptured={(mediaUrl) => {
                    console.log('Media captured:', mediaUrl);
                  }}
                  reportId={currentReport?.id}
                  existingMedia={[]}
                />
              </div>
            </TabsContent>

            <TabsContent value="summary" className="space-y-4 h-full">
              <ReportSummary
                task={task}
                template={currentTemplate}
                checklist={checklist}
                issues={issues}
                notes={notes}
                completionPercentage={completionPercentage}
              />
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer Actions */}
        <div className="border-t pt-4 flex items-center justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={isCreatingReport || isUpdatingReport}
            >
              <Save className="h-4 w-4 mr-2" />
              {isCreatingReport || isUpdatingReport ? 'Guardando...' : 'Guardar'}
            </Button>
            
            <Button
              onClick={handleComplete}
              disabled={!canComplete || isCreatingReport || isUpdatingReport}
              className={canComplete ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Completar Reporte
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
