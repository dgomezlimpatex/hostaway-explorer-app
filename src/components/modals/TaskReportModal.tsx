
import React, { useState, useEffect, useMemo } from 'react';
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
        
        // Load existing general media (photos not tied to specific checklist items)
        const generalMedia = taskMedia
          .filter(media => !media.checklist_item_id)
          .map(media => media.file_url);
        setReportMedia(generalMedia);
      } else {
        console.log('TaskReportModal - creating new report immediately');
        // Create report immediately to have reportId for media upload
        const reportData = {
          task_id: task.id,
          cleaner_id: currentCleanerId || task.cleanerId,
          checklist_completed: {},
          notes: '',
          issues_found: [],
          overall_status: 'pending' as const,
          start_time: new Date().toISOString(),
        };
        
        createReport(reportData);
        setChecklist({});
        setNotes('');
        setIssues([]);
        setReportMedia([]);
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
  }, [open, task, existingReport, templates, createReport, currentCleanerId, taskMedia]);

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
          />
        </div>

        <div className="flex-shrink-0">
          <TaskReportFooter
            onCancel={() => onOpenChange(false)}
            onSave={handleSave}
            onComplete={handleComplete}
            canComplete={canComplete}
            isCreatingReport={isCreatingReport}
            isUpdatingReport={isUpdatingReport}
            completionPercentage={completionPercentage}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
