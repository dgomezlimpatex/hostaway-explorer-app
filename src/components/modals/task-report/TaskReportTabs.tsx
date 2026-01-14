import React from 'react';
import { Clock, CheckSquare, AlertTriangle, Camera, BarChart3 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Task } from '@/types/calendar';
import { TaskChecklistTemplate, TaskMedia, TaskReport } from '@/types/taskReports';
import { ChecklistSection } from './ChecklistSection';
import { NotesSection } from './NotesSection';
import { MediaCapture } from './MediaCapture';
import { ReportSummary } from './ReportSummary';
import { SequentialTaskReport } from './SequentialTaskReport';
import { useDeviceType } from '@/hooks/use-mobile';

interface TaskReportTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  currentStep: 'checklist' | 'media' | 'summary';
  onStepChange: (step: 'checklist' | 'media' | 'summary') => void;
  isLoadingTemplates: boolean;
  currentTemplate: TaskChecklistTemplate | undefined;
  checklist: Record<string, any>;
  onChecklistChange: (checklist: Record<string, any>) => void;
  reportId?: string;
  notes: string;
  onNotesChange: (notes: string) => void;
  task: Task;
  completionPercentage: number;
  reportMedia: TaskMedia[];
  onReportMediaChange: (media: TaskMedia[]) => void;
  isTaskCompleted?: boolean;
  hasStartedTask: boolean;
  onComplete: () => Promise<void>;
  currentReport?: TaskReport;
  onAdditionalTaskComplete?: (subtaskId: string, completed: boolean, notes?: string, mediaUrls?: string[]) => void;
}

export const TaskReportTabs: React.FC<TaskReportTabsProps> = ({
  activeTab,
  onTabChange,
  currentStep,
  onStepChange,
  isLoadingTemplates,
  currentTemplate,
  checklist,
  onChecklistChange,
  reportId,
  notes,
  onNotesChange,
  task,
  completionPercentage,
  reportMedia,
  onReportMediaChange,
  isTaskCompleted = false,
  hasStartedTask,
  onComplete,
  currentReport,
  onAdditionalTaskComplete,
}) => {
  const { isMobile } = useDeviceType();

  // Use sequential flow for mobile, tabs for desktop
  if (isMobile) {
    return (
      <SequentialTaskReport
        currentStep={currentStep}
        onStepChange={onStepChange}
        isLoadingTemplates={isLoadingTemplates}
        currentTemplate={currentTemplate}
        checklist={checklist}
        onChecklistChange={onChecklistChange}
        reportId={reportId}
        notes={notes}
        onNotesChange={onNotesChange}
        task={task}
        completionPercentage={completionPercentage}
        reportMedia={reportMedia}
        onReportMediaChange={onReportMediaChange}
        isTaskCompleted={isTaskCompleted}
        hasStartedTask={hasStartedTask}
        onComplete={onComplete}
        currentReport={currentReport}
        onAdditionalTaskComplete={onAdditionalTaskComplete}
      />
    );
  }

  const getTabLabel = (key: string, icon: React.ReactNode, label: string, shortLabel?: string): React.ReactNode => {
    return (
      <div className="flex items-center space-x-2">
        {icon}
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">{shortLabel || label}</span>
      </div>
    );
  };

  if (!hasStartedTask && !isTaskCompleted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Clock className="h-16 w-16 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-600 mb-2">Tarea no iniciada</h3>
        <p className="text-gray-500">Haz clic en "Iniciar Tarea" para comenzar el reporte</p>
      </div>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="flex flex-col h-full">
      <TabsList className="grid w-full grid-cols-2 mb-4">
        <TabsTrigger value="checklist" className="text-xs">
          {getTabLabel('checklist', <CheckSquare className="h-4 w-4" />, 'Lista', 'Lista')}
        </TabsTrigger>
        <TabsTrigger value="summary" className="text-xs">
          {getTabLabel('summary', <BarChart3 className="h-4 w-4" />, 'Resumen', 'Resumen')}
        </TabsTrigger>
      </TabsList>

      <div className="flex-1 overflow-auto">
        <TabsContent value="checklist" className="mt-0 h-full overflow-auto">
          {isLoadingTemplates ? (
            <div className="flex items-center justify-center py-8">
              <Clock className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <ChecklistSection
              template={currentTemplate}
              checklist={checklist}
              onChecklistChange={onChecklistChange}
              reportId={reportId}
              isReadOnly={isTaskCompleted}
              task={task}
              onAdditionalTaskComplete={onAdditionalTaskComplete}
            />
          )}
        </TabsContent>

        <TabsContent value="summary" className="mt-0 h-full overflow-auto">
          <ReportSummary
            task={task}
            template={currentTemplate}
            checklist={checklist}
            notes={notes}
            completionPercentage={completionPercentage}
            currentReport={currentReport}
          />
        </TabsContent>
      </div>
    </Tabs>
  );
};