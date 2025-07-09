
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { CheckSquare, AlertTriangle, FileText, Camera, CheckCircle, Clock } from 'lucide-react';
import { Task } from '@/types/calendar';
import { TaskChecklistTemplate, TaskMedia } from '@/types/taskReports';
import { ChecklistSection } from './ChecklistSection';
import { MediaCapture } from './MediaCapture';
import { IssuesSection } from './IssuesSection';
import { NotesSection } from './NotesSection';
import { ReportSummary } from './ReportSummary';
import { useDeviceType } from '@/hooks/use-mobile';

interface TaskReportTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
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
}

export const TaskReportTabs: React.FC<TaskReportTabsProps> = ({
  activeTab,
  onTabChange,
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
  hasStartedTask
}) => {
  const { isMobile, isTablet } = useDeviceType();

  // Responsive tab labels
  const getTabLabel = (key: string, icon: React.ReactNode, label: string, shortLabel?: string) => {
    const displayLabel = isMobile && shortLabel ? shortLabel : label;
    return (
      <div className="flex items-center gap-1 md:gap-2">
        {icon}
        <span className={`${isMobile ? 'text-xs' : 'text-sm'}`}>{displayLabel}</span>
      </div>
    );
  };

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="flex-1 flex flex-col overflow-hidden">
      <TabsList className={`grid w-full ${isMobile ? 'grid-cols-4' : 'grid-cols-5'} ${isMobile ? 'gap-1' : ''}`}>
        <TabsTrigger 
          value="checklist" 
          className={`${isMobile ? 'px-2 py-1.5' : 'px-3 py-2'} flex items-center justify-center`}
        >
          {getTabLabel('checklist', <CheckSquare className="h-3 w-3 md:h-4 md:w-4" />, 'Checklist', 'Lista')}
        </TabsTrigger>
        
        <TabsTrigger 
          value="issues" 
          className={`${isMobile ? 'px-2 py-1.5' : 'px-3 py-2'} flex items-center justify-center`}
        >
          {getTabLabel('issues', <AlertTriangle className="h-3 w-3 md:h-4 md:w-4" />, 'Incidencias', 'Issues')}
          {issues.length > 0 && (
            <Badge variant="destructive" className="ml-1 text-xs px-1 py-0.5 h-auto min-w-[16px]">
              {issues.length}
            </Badge>
          )}
        </TabsTrigger>

        {/* Show media tab on mobile but hide notes */}
        {isMobile ? (
          <TabsTrigger 
            value="media" 
            className="px-2 py-1.5 flex items-center justify-center"
          >
            {getTabLabel('media', <Camera className="h-3 w-3" />, 'Fotos')}
          </TabsTrigger>
        ) : (
          <>
            <TabsTrigger 
              value="notes" 
              className="px-3 py-2 flex items-center justify-center"
            >
              {getTabLabel('notes', <FileText className="h-4 w-4" />, 'Notas')}
            </TabsTrigger>
            
            <TabsTrigger 
              value="media" 
              className="px-3 py-2 flex items-center justify-center"
            >
              {getTabLabel('media', <Camera className="h-4 w-4" />, 'Fotos')}
            </TabsTrigger>
          </>
        )}
        
        <TabsTrigger 
          value="summary" 
          className={`${isMobile ? 'px-2 py-1.5' : 'px-3 py-2'} flex items-center justify-center`}
        >
          {getTabLabel('summary', <CheckCircle className="h-3 w-3 md:h-4 md:w-4" />, 'Resumen', 'Fin')}
        </TabsTrigger>
      </TabsList>

      <div className="flex-1 overflow-auto">
        <TabsContent value="checklist" className={`${isMobile ? 'space-y-2 p-2' : 'space-y-4 p-4'} overflow-auto max-h-full`}>
          {!hasStartedTask && !isTaskCompleted ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">Tarea no iniciada</h3>
              <p className="text-gray-500">Haz clic en "Iniciar Tarea" para comenzar el reporte</p>
            </div>
          ) : isLoadingTemplates ? (
            <div className="flex items-center justify-center py-6 md:py-8">
              <Clock className="h-6 w-6 md:h-8 md:w-8 animate-spin text-gray-400" />
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

        <TabsContent value="issues" className={`${isMobile ? 'space-y-2 p-2' : 'space-y-4 p-4'} overflow-auto max-h-full`}>
          {!hasStartedTask && !isTaskCompleted ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">Tarea no iniciada</h3>
              <p className="text-gray-500">Inicia la tarea para registrar incidencias</p>
            </div>
          ) : (
            <IssuesSection
              issues={issues}
              onIssuesChange={onIssuesChange}
              reportId={reportId}
            />
          )}
        </TabsContent>

        {/* Show notes only on desktop */}
        {!isMobile && (
          <TabsContent value="notes" className="space-y-4 p-4 overflow-auto max-h-full">
            {!hasStartedTask && !isTaskCompleted ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-16 w-16 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">Tarea no iniciada</h3>
                <p className="text-gray-500">Inicia la tarea para agregar notas</p>
              </div>
            ) : (
              <NotesSection
                notes={notes}
                onNotesChange={onNotesChange}
              />
            )}
          </TabsContent>
        )}

        {/* Show media tab on both mobile and desktop */}
        <TabsContent value="media" className={`${isMobile ? 'space-y-2 p-2' : 'space-y-4 p-4'} overflow-auto max-h-full`}>
          {!hasStartedTask && !isTaskCompleted ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Camera className="h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">Tarea no iniciada</h3>
              <p className="text-gray-500">Inicia la tarea para subir fotos y videos</p>
            </div>
          ) : (
            <div className="space-y-6">
              <h3 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold`}>Fotos y Videos</h3>
              <MediaCapture
                onMediaCaptured={(mediaUrl) => {
                  console.log('Media captured (general):', mediaUrl);
                  // No need to update reportMedia here, it will be refreshed by the query
                }}
                onMediaDeleted={(mediaId) => {
                  console.log('Media deleted (general):', mediaId);
                  // Remove the media from the local state
                  const updatedMedia = reportMedia.filter(media => media.id !== mediaId);
                  onReportMediaChange(updatedMedia);
                }}
                reportId={reportId}
                existingMedia={reportMedia}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="summary" className={`${isMobile ? 'space-y-2 p-2' : 'space-y-4 p-4'} overflow-auto max-h-full`}>
          {!hasStartedTask && !isTaskCompleted ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle className="h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">Tarea no iniciada</h3>
              <p className="text-gray-500">Inicia la tarea para ver el resumen del progreso</p>
            </div>
          ) : (
            <ReportSummary
              task={task}
              template={currentTemplate}
              checklist={checklist}
              issues={issues}
              notes={notes}
              completionPercentage={completionPercentage}
            />
          )}
        </TabsContent>
      </div>
    </Tabs>
  );
};
