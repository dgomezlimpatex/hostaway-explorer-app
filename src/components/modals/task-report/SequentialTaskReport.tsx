import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckSquare, CheckCircle, Clock, ArrowRight } from 'lucide-react';
import { Task } from '@/types/calendar';
import { TaskChecklistTemplate, TaskMedia, TaskReport } from '@/types/taskReports';
import { ChecklistSection } from './ChecklistSection';
import { ReportSummary } from './ReportSummary';
import { useDeviceType } from '@/hooks/use-mobile';
import { useMobileErrorHandler } from '@/hooks/useMobileErrorHandler';
import { cn } from '@/lib/utils';

interface SequentialTaskReportProps {
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

const TaskNotStartedPlaceholder: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <Clock className="h-16 w-16 text-muted-foreground/30 mb-4" />
    <h3 className="text-lg font-semibold text-muted-foreground mb-2">Tarea no iniciada</h3>
    <p className="text-muted-foreground/70">Haz clic en "Iniciar Tarea" para comenzar el reporte</p>
  </div>
);

export const SequentialTaskReport: React.FC<SequentialTaskReportProps> = ({
  currentStep,
  onStepChange,
  isLoadingTemplates,
  currentTemplate,
  checklist,
  onChecklistChange,
  reportId,
  notes,
  task,
  completionPercentage,
  reportMedia,
  isTaskCompleted = false,
  hasStartedTask,
  onComplete,
  currentReport,
  onAdditionalTaskComplete,
}) => {
  const { isMobile } = useDeviceType();
  const { addError } = useMobileErrorHandler();

  const steps = [
    { key: 'checklist', title: 'Checklist', icon: CheckSquare },
    { key: 'summary', title: 'Resumen', icon: CheckCircle },
  ];

  const currentStepIndex = steps.findIndex(step => step.key === currentStep);

  const canProceedToNext = () => {
    if (isTaskCompleted) return true;
    switch (currentStep) {
      case 'checklist':
        return completionPercentage >= 100;
      case 'summary':
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    try {
      const nextIndex = currentStepIndex + 1;
      if (nextIndex < steps.length) {
        onStepChange(steps[nextIndex].key as typeof currentStep);
      }
    } catch (error) {
      console.error('❌ Error in handleNext:', error);
    }
  };

  const handlePrevious = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      onStepChange(steps[prevIndex].key as typeof currentStep);
    }
  };

  const showNotStartedPlaceholder = !hasStartedTask && !isTaskCompleted;

  return (
    <React.Fragment key={`sequential-${task.id}-${hasStartedTask ? 'started' : 'not-started'}`}>
      {showNotStartedPlaceholder ? (
        <TaskNotStartedPlaceholder key="placeholder" />
      ) : (
        <div key="content" className="flex flex-col h-full max-h-[calc(100vh-180px)] overflow-hidden">
          {/* Step indicators - compact pill style */}
          <div className="flex-shrink-0 px-4 py-2.5 border-b border-border/40 bg-muted/10">
            <div className="flex items-center gap-1.5">
              {steps.map((step, index) => {
                const StepIcon = step.icon;
                const isActive = index === currentStepIndex;
                const isCompleted = index < currentStepIndex;
                
                return (
                  <React.Fragment key={step.key}>
                    {index > 0 && (
                      <div className={cn(
                        "h-0.5 flex-1 rounded-full transition-colors duration-300",
                        isCompleted ? "bg-primary" : "bg-border"
                      )} />
                    )}
                    <button
                      onClick={() => {
                        if (isCompleted || isTaskCompleted) {
                          onStepChange(step.key as typeof currentStep);
                        }
                      }}
                      disabled={!isCompleted && !isActive && !isTaskCompleted}
                      className={cn(
                        "flex items-center gap-1.5 py-1.5 px-4 rounded-full transition-all text-xs font-semibold",
                        isActive 
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/25" 
                          : isCompleted 
                            ? "bg-primary/10 text-primary" 
                            : "text-muted-foreground/50"
                      )}
                    >
                      <StepIcon className="h-3.5 w-3.5" />
                      <span>{step.title}</span>
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Step Content */}
          <div className="flex-1 overflow-y-auto overscroll-contain pb-20">
            {currentStep === 'checklist' && (
              <div className="px-2 py-2">
                {isLoadingTemplates ? (
                  <div className="flex items-center justify-center py-8">
                    <Clock className="h-8 w-8 animate-spin text-muted-foreground/40" />
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
              </div>
            )}

            {currentStep === 'summary' && (
              <div className="p-3 space-y-4">
                <div className="text-center py-3">
                  <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-2" />
                  <h4 className="text-base font-semibold mb-1">Resumen Final</h4>
                  <p className="text-xs text-muted-foreground">
                    Revisa el reporte antes de finalizarlo
                  </p>
                </div>
                <ReportSummary
                  task={task}
                  template={currentTemplate}
                  checklist={checklist}
                  notes={notes}
                  completionPercentage={completionPercentage}
                  currentReport={currentReport}
                />
                
                {!isTaskCompleted && completionPercentage < 100 && (
                  <div className="pt-3 border-t">
                    <p className="text-xs text-muted-foreground text-center">
                      Completa todas las tareas obligatorias para finalizar
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Fixed bottom navigation - only on checklist step */}
          {currentStep !== 'summary' && (
            <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t shadow-lg px-4 py-3 z-50 safe-area-pb">
              <div className="flex items-center gap-3 max-w-lg mx-auto">
                <Button
                  onClick={handleNext}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    if (canProceedToNext() && currentStepIndex < steps.length - 1) {
                      handleNext();
                    }
                  }}
                  disabled={!canProceedToNext() || currentStepIndex === steps.length - 1}
                  className="flex-1 h-12 text-sm font-semibold touch-manipulation"
                >
                  Siguiente: Resumen
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
              
              {!canProceedToNext() && (
                <p className="text-[11px] text-center text-muted-foreground mt-1.5">
                  Completa todas las tareas para continuar
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </React.Fragment>
  );
};
