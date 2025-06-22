
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
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="flex-1 flex flex-col overflow-hidden">
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
              onChecklistChange={onChecklistChange}
              reportId={reportId}
            />
          )}
        </TabsContent>

        <TabsContent value="issues" className="space-y-4 h-full">
          <IssuesSection
            issues={issues}
            onIssuesChange={onIssuesChange}
            reportId={reportId}
          />
        </TabsContent>

        <TabsContent value="notes" className="space-y-4 h-full">
          <NotesSection
            notes={notes}
            onNotesChange={onNotesChange}
          />
        </TabsContent>

        <TabsContent value="media" className="space-y-4 h-full">
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
  );
};
