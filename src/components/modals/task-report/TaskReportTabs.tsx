import React from 'react';
import { Clock, CheckSquare, AlertTriangle, Camera, BarChart3 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Task } from '@/types/calendar';
import { TaskChecklistTemplate, TaskMedia } from '@/types/taskReports';
import { ChecklistSection } from './ChecklistSection';
import { IssuesSection } from './IssuesSection';
import { NotesSection } from './NotesSection';
import { MediaCapture } from './MediaCapture';
import { ReportSummary } from './ReportSummary';
import { SequentialTaskReport } from './SequentialTaskReport';
import { useDeviceType } from '@/hooks/use-mobile';

interface TaskReportTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  currentStep: 'checklist' | 'issues' | 'media' | 'summary';
  onStepChange: (step: 'checklist' | 'issues' | 'media' | 'summary') => void;
  issues: any[];
  isLoadingTemplates: boolean;
  currentTemplate: TaskChecklistTemplate | undefined;
  checklist: Record<string, any>;
  onChecklistChange: (checklist: Record<string, any>) => void;
  reportId?: string;
  onIssuesChange: (issues: any[]) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  task: Task;
  completionPercentage: number;
  reportMedia: TaskMedia[];
  onReportMediaChange: (media: TaskMedia[]) => void;
  isTaskCompleted?: boolean;
  hasStartedTask: boolean;
  onComplete: () => Promise<void>;
}

export const TaskReportTabs: React.FC<TaskReportTabsProps> = ({
  activeTab,
  onTabChange,
  currentStep,
  onStepChange,
  issues,
  isLoadingTemplates,
  currentTemplate,
  checklist,
  onChecklistChange,
  reportId,
  onIssuesChange,
  notes,
  onNotesChange,
  task,
  completionPercentage,
  reportMedia,
  onReportMediaChange,
  isTaskCompleted = false,
  hasStartedTask,
  onComplete,
}) => {
  const { isMobile } = useDeviceType();

  // Use sequential flow for mobile, tabs for desktop
  if (isMobile) {
    return (
      <SequentialTaskReport
        currentStep={currentStep}
        onStepChange={onStepChange}
        issues={issues}
        isLoadingTemplates={isLoadingTemplates}
        currentTemplate={currentTemplate}
        checklist={checklist}
        onChecklistChange={onChecklistChange}
        reportId={reportId}
        onIssuesChange={onIssuesChange}
        notes={notes}
        onNotesChange={onNotesChange}
        task={task}
        completionPercentage={completionPercentage}
        reportMedia={reportMedia}
        onReportMediaChange={onReportMediaChange}
        isTaskCompleted={isTaskCompleted}
        hasStartedTask={hasStartedTask}
        onComplete={onComplete}
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
      <TabsList className="grid w-full grid-cols-4 mb-4">
        <TabsTrigger value="checklist" className="text-xs">
          {getTabLabel('checklist', <CheckSquare className="h-4 w-4" />, 'Lista', 'Lista')}
        </TabsTrigger>
        <TabsTrigger value="issues" className="text-xs">
          {getTabLabel('issues', <AlertTriangle className="h-4 w-4" />, 'Issues', 'Issues')}
        </TabsTrigger>
        <TabsTrigger value="photos" className="text-xs">
          {getTabLabel('photos', <Camera className="h-4 w-4" />, 'Fotos', 'Fotos')}
        </TabsTrigger>
        <TabsTrigger value="summary" className="text-xs">
          {getTabLabel('summary', <BarChart3 className="h-4 w-4" />, 'Fin', 'Fin')}
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
            />
          )}
        </TabsContent>

        <TabsContent value="issues" className="mt-0 h-full overflow-auto">
          <IssuesSection
            issues={issues}
            onIssuesChange={onIssuesChange}
            reportId={reportId}
            isReadOnly={isTaskCompleted}
          />
        </TabsContent>

        <TabsContent value="photos" className="mt-0 h-full overflow-auto">
          <MediaCapture
            onMediaCaptured={(mediaUrl) => {
              console.log('Media captured:', mediaUrl);
              // Actualizar el checklist para reflejar las fotos subidas
              if (currentTemplate) {
                const updatedChecklist = { ...checklist };
                let updated = false;
                
                // Buscar items que requieren fotos y no tienen fotos aún
                currentTemplate.checklist_items.forEach(category => {
                  category.items.forEach(item => {
                    if (item.photo_required) {
                      const key = `${category.id}.${item.id}`;
                      const itemData = updatedChecklist[key] || {};
                      
                      // Si el item no tiene fotos, agregar esta foto
                      if (!itemData.media_urls || itemData.media_urls.length === 0) {
                        updatedChecklist[key] = {
                          ...itemData,
                          media_urls: [mediaUrl]
                        };
                        updated = true;
                        return; // Solo asignar a un item por foto
                      }
                    }
                  });
                });
                
                if (updated) {
                  onChecklistChange(updatedChecklist);
                }
              }
            }}
            onMediaDeleted={(mediaId) => {
              const updatedMedia = reportMedia.filter(media => media.id !== mediaId);
              onReportMediaChange(updatedMedia);
            }}
            reportId={reportId}
            existingMedia={reportMedia}
            isReadOnly={isTaskCompleted}
          />
        </TabsContent>

        <TabsContent value="summary" className="mt-0 h-full overflow-auto">
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
  );
};