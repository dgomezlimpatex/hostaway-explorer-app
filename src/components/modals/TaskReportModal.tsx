
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Task } from '@/types/calendar';
import { TaskReport, TaskChecklistTemplate } from '@/types/taskReports';
import { useTaskReports, useTaskReport, useChecklistTemplates, useTaskMedia } from '@/hooks/useTaskReports';
import { useToast } from '@/hooks/use-toast';
import { useDeviceType } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import { useCleaners } from '@/hooks/useCleaners';
import { TaskReportHeader } from './task-report/TaskReportHeader';
import { TaskReportTabs } from './task-report/TaskReportTabs';
import { TaskReportFooter } from './task-report/TaskReportFooter';

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
  const { isMobile, isTablet } = useDeviceType();
  const { createReport, updateReport, isCreatingReport, isUpdatingReport } = useTaskReports();
  const { data: existingReport, isLoading: isLoadingReport } = useTaskReport(task?.id || '');
  const { data: templates, isLoading: isLoadingTemplates } = useChecklistTemplates();
  const { user, userRole } = useAuth();
  const { cleaners } = useCleaners();

  const [currentReport, setCurrentReport] = useState<TaskReport | null>(null);
  const [checklist, setChecklist] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState('');
  const [issues, setIssues] = useState<any[]>([]);
  const [reportMedia, setReportMedia] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('checklist');
  const [currentTemplate, setCurrentTemplate] = useState<TaskChecklistTemplate | undefined>();
  const [hasStartedTask, setHasStartedTask] = useState(false);
  
  // Ref to track if we've already tried to create a report for this task
  const reportCreationAttempted = useRef<string | null>(null);

  // Get task media using the current report ID
  const { data: taskMedia = [], isLoading: isLoadingMedia } = useTaskMedia(currentReport?.id || '');

  // Get current cleaner ID
  const currentCleanerId = useMemo(() => {
    if (!user?.id || !cleaners) return null;
    const currentCleaner = cleaners.find(cleaner => cleaner.user_id === user.id);
    return currentCleaner?.id || null;
  }, [user?.id, cleaners]);

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
        setHasStartedTask(true); // Task already started if report exists
        reportCreationAttempted.current = task.id; // Mark as handled
      } else {
        // Reset state for new task
        setCurrentReport(null);
        setChecklist({});
        setNotes('');
        setIssues([]);
        setReportMedia([]);
        setHasStartedTask(false);
        reportCreationAttempted.current = null;
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

  // Reset creation tracking when modal closes
  useEffect(() => {
    if (!open) {
      reportCreationAttempted.current = null;
      setHasStartedTask(false);
    }
  }, [open]);

  // Update currentReport when existingReport changes (after creation)
  useEffect(() => {
    if (existingReport && !currentReport) {
      console.log('TaskReportModal - setting created report:', existingReport);
      setCurrentReport(existingReport);
    }
  }, [existingReport, currentReport]);

  // Update reportMedia when taskMedia changes
  useEffect(() => {
    if (taskMedia && currentReport) {
      const generalMedia = taskMedia
        .filter(media => !media.checklist_item_id)
        .map(media => media.file_url);
      setReportMedia(generalMedia);
      console.log('TaskReportModal - loaded general media:', generalMedia);
    }
  }, [taskMedia, currentReport]);

  // Validate if task is from today - stricter validation
  const isTaskFromToday = useMemo(() => {
    if (!task) return false;
    const today = new Date();
    const taskDate = new Date(task.date + 'T00:00:00');
    return taskDate.toDateString() === today.toDateString();
  }, [task]);

  // Validate required items completion
  const requiredValidation = useMemo(() => {
    if (!currentTemplate) return { isValid: true, missingItems: [], missingPhotos: [] };
    
    const missingItems: string[] = [];
    const missingPhotos: string[] = [];
    
    currentTemplate.checklist_items.forEach(category => {
      category.items.forEach(item => {
        const key = `${category.id}.${item.id}`;
        const itemData = checklist[key];
        
        if (item.required && !itemData?.completed) {
          missingItems.push(item.task);
        }
        
        if (item.photo_required && (!itemData?.media_urls || itemData.media_urls.length === 0)) {
          missingPhotos.push(item.task);
        }
      });
    });
    
    return {
      isValid: missingItems.length === 0 && missingPhotos.length === 0,
      missingItems,
      missingPhotos
    };
  }, [checklist, currentTemplate]);

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

  const handleStartTask = async () => {
    if (!task || !isTaskFromToday) {
      toast({
        title: "Error",
        description: "Solo puedes iniciar tareas del día de hoy.",
        variant: "destructive",
      });
      return;
    }

    if (reportCreationAttempted.current !== task.id) {
      console.log('TaskReportModal - starting task and creating report');
      reportCreationAttempted.current = task.id;
      
      // Create report with start time
      const reportData = {
        task_id: task.id,
        cleaner_id: currentCleanerId || task.cleanerId,
        checklist_completed: {},
        notes: '',
        issues_found: [],
        overall_status: 'in_progress' as const,
        start_time: new Date().toISOString(),
      };
      
      createReport(reportData);
      setHasStartedTask(true);
      
      toast({
        title: "Tarea iniciada",
        description: "El reporte se ha iniciado correctamente.",
      });
    }
  };

  const handleSave = async () => {
    if (!task) return;

    const reportData = {
      task_id: task.id,
      cleaner_id: currentCleanerId || task.cleanerId,
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
    if (!task) return;

    // Validar que la tarea sea de hoy
    if (!isTaskFromToday) {
      toast({
        title: "Error",
        description: "Solo puedes completar tareas del día de hoy.",
        variant: "destructive",
      });
      return;
    }

    // Validar que todas las tareas obligatorias estén completadas
    if (!requiredValidation.isValid) {
      const messages = [];
      if (requiredValidation.missingItems.length > 0) {
        messages.push(`Tareas pendientes: ${requiredValidation.missingItems.join(', ')}`);
      }
      if (requiredValidation.missingPhotos.length > 0) {
        messages.push(`Fotos requeridas: ${requiredValidation.missingPhotos.join(', ')}`);
      }
      
      toast({
        title: "Reporte incompleto",
        description: messages.join('. '),
        variant: "destructive",
      });
      return;
    }

    const reportData = {
      task_id: task.id,
      cleaner_id: currentCleanerId || task.cleanerId,
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

      // También actualizar el estado de la tarea
      const { supabase } = await import('@/integrations/supabase/client');
      await supabase
        .from('tasks')
        .update({ status: 'completed' })
        .eq('id', task.id);
      
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

  const canComplete = isTaskFromToday && requiredValidation.isValid;
  const reportStatus = currentReport?.overall_status || 'pending';
  
  // Detectar si la tarea está completada
  const isTaskCompleted = task.status === 'completed' || reportStatus === 'completed';

  // Responsive modal classes
  const getModalClasses = () => {
    if (isMobile) {
      return "w-full max-w-full h-full max-h-full m-0 rounded-none overflow-hidden flex flex-col";
    }
    if (isTablet) {
      return "w-[95vw] max-w-3xl max-h-[85vh] overflow-hidden flex flex-col";
    }
    return "max-w-4xl max-h-[90vh] overflow-hidden flex flex-col";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={getModalClasses()}>
        <DialogHeader className="flex-shrink-0">
          <TaskReportHeader
            task={task}
            reportStatus={reportStatus}
            completionPercentage={completionPercentage}
            isLoadingReport={isLoadingReport}
          />
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          <TaskReportTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            issues={issues}
            isLoadingTemplates={isLoadingTemplates}
            currentTemplate={currentTemplate}
            checklist={checklist}
            onChecklistChange={setChecklist}
            reportId={currentReport?.id}
            onIssuesChange={setIssues}
            notes={notes}
            onNotesChange={setNotes}
            task={task}
            completionPercentage={completionPercentage}
            reportMedia={reportMedia}
            onReportMediaChange={setReportMedia}
            isTaskCompleted={isTaskCompleted}
            hasStartedTask={hasStartedTask}
          />
        </div>

        <div className="flex-shrink-0">
          <TaskReportFooter
            onCancel={() => onOpenChange(false)}
            onSave={handleSave}
            onComplete={handleComplete}
            onStartTask={handleStartTask}
            canComplete={canComplete}
            isCreatingReport={isCreatingReport}
            isUpdatingReport={isUpdatingReport}
            completionPercentage={completionPercentage}
            requiredValidation={requiredValidation}
            isTaskFromToday={isTaskFromToday}
            isTaskCompleted={isTaskCompleted}
            hasStartedTask={hasStartedTask}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
