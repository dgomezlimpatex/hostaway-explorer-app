
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Task } from '@/types/calendar';
import { TaskReport, TaskChecklistTemplate } from '@/types/taskReports';
import { useTaskReports, useTaskReport, useChecklistTemplates } from '@/hooks/useTaskReports';
import { useToast } from '@/hooks/use-toast';
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
    if (!task) return;

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
          <TaskReportHeader
            task={task}
            reportStatus={reportStatus}
            completionPercentage={completionPercentage}
            isLoadingReport={isLoadingReport}
          />
        </DialogHeader>

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
        />

        <TaskReportFooter
          onCancel={() => onOpenChange(false)}
          onSave={handleSave}
          onComplete={handleComplete}
          canComplete={canComplete}
          isCreatingReport={isCreatingReport}
          isUpdatingReport={isUpdatingReport}
          completionPercentage={completionPercentage}
        />
      </DialogContent>
    </Dialog>
  );
};
