
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { CheckSquare, AlertTriangle, FileText, Camera, CheckCircle, Clock } from 'lucide-react';
import { Task } from '@/types/calendar';
import { TaskChecklistTemplate } from '@/types/taskReports';
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
  completionPercentage
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
      <TabsList className={`grid w-full ${isMobile ? 'grid-cols-3' : 'grid-cols-5'} ${isMobile ? 'gap-1' : ''}`}>
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

        {/* Hide some tabs on mobile to fit better */}
        {!isMobile && (
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
          {isLoadingTemplates ? (
            <div className="flex items-center justify-center py-6 md:py-8">
              <Clock className="h-6 w-6 md:h-8 md:w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <ChecklistSection
              template={currentTemplate}
              checklist={checklist}
              onChecklistChange={onChecklistChange}
              reportId={reportId}
            />
          )}
        </TabsContent>

        <TabsContent value="issues" className={`${isMobile ? 'space-y-2 p-2' : 'space-y-4 p-4'} overflow-auto max-h-full`}>
          <IssuesSection
            issues={issues}
            onIssuesChange={onIssuesChange}
            reportId={reportId}
          />
        </TabsContent>

        {!isMobile && (
          <>
            <TabsContent value="notes" className="space-y-4 p-4 overflow-auto max-h-full">
              <NotesSection
                notes={notes}
                onNotesChange={onNotesChange}
              />
            </TabsContent>

            <TabsContent value="media" className="space-y-4 p-4 overflow-auto max-h-full">
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Fotos y Videos</h3>
                <MediaCapture
                  onMediaCaptured={(mediaUrl) => {
                    console.log('Media captured:', mediaUrl);
                  }}
                  reportId={reportId}
                  existingMedia={[]}
                />
              </div>
            </TabsContent>
          </>
        )}

        <TabsContent value="summary" className={`${isMobile ? 'space-y-2 p-2' : 'space-y-4 p-4'} overflow-auto max-h-full`}>
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
