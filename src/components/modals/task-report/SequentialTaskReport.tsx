import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckSquare, AlertTriangle, Camera, CheckCircle, Clock, ArrowLeft, ArrowRight } from 'lucide-react';
import { Task } from '@/types/calendar';
import { TaskChecklistTemplate, TaskMedia, TaskReport } from '@/types/taskReports';
import { ChecklistSection } from './ChecklistSection';
import { MediaCapture } from './MediaCapture';
import { ReportSummary } from './ReportSummary';
import { useDeviceType } from '@/hooks/use-mobile';
import { useMobileErrorHandler } from '@/hooks/useMobileErrorHandler';

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

export const SequentialTaskReport: React.FC<SequentialTaskReportProps> = ({
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
  const { addError } = useMobileErrorHandler();

  const steps = [
    { key: 'checklist', title: 'Lista de Tareas', icon: CheckSquare, description: 'Completa todas las tareas del checklist' },
    { key: 'summary', title: 'Resumen', icon: CheckCircle, description: 'Revisa y finaliza el reporte' },
  ];

  const currentStepIndex = steps.findIndex(step => step.key === currentStep);
  const progressPercentage = ((currentStepIndex + 1) / steps.length) * 100;

  const canProceedToNext = () => {
    // Si la tarea está completada, permitir navegación libre
    if (isTaskCompleted) return true;
    
    const canProceed = (() => {
      switch (currentStep) {
        case 'checklist':
          return completionPercentage === 100;
        case 'summary':
          return true;
        default:
          return false;
      }
    })();

    console.log('🔍 canProceedToNext debug:', {
      currentStep,
      canProceed,
      isTaskCompleted,
      completionPercentage,
      reportMediaLength: reportMedia.length,
      currentStepIndex,
      stepsLength: steps.length
    });

    return canProceed;
  };

  const handleNext = () => {
    console.log('🔄 handleNext clicked:', {
      currentStep,
      currentStepIndex,
      nextIndex: currentStepIndex + 1,
      stepsLength: steps.length,
      canProceed: canProceedToNext(),
      nextStepKey: steps[currentStepIndex + 1]?.key
    });

    try {
      const nextIndex = currentStepIndex + 1;
      if (nextIndex < steps.length) {
        console.log('✅ Navigating to next step:', steps[nextIndex].key);
        onStepChange(steps[nextIndex].key as typeof currentStep);
      } else {
        console.log('❌ Cannot navigate - at last step');
        if (isMobile) {
          addError(
            'general',
            'Navegación bloqueada',
            'Has llegado al final del formulario',
            { currentStep, currentStepIndex, stepsLength: steps.length }
          );
        }
      }
    } catch (error) {
      console.error('❌ Error in handleNext:', error);
      if (isMobile) {
        addError(
          'general',
          'Error de navegación',
          `No se pudo avanzar desde ${currentStep}`,
          { currentStep, error: error instanceof Error ? error.message : 'Error desconocido' },
          'Haciendo click en botón Siguiente'
        );
      }
    }
  };

  const handlePrevious = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      onStepChange(steps[prevIndex].key as typeof currentStep);
    }
  };

  const handleFinishReport = async () => {
    await onComplete();
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
    <div className="flex flex-col h-full max-h-[calc(100vh-200px)] overflow-hidden">
      {/* Step Indicators - Ultra compact */}
      <div className="flex-shrink-0 px-2 py-1.5 border-b bg-muted/30">
        <div className="flex items-center gap-1">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = index === currentStepIndex;
            const isCompleted = index < currentStepIndex;
            
            return (
              <button
                key={step.key}
                onClick={() => {
                  if (isCompleted || isTaskCompleted) {
                    onStepChange(step.key as typeof currentStep);
                  }
                }}
                disabled={!isCompleted && !isActive && !isTaskCompleted}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-md transition-all text-xs font-medium ${
                  isActive 
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : isCompleted 
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                      : 'bg-muted text-muted-foreground opacity-50'
                }`}
              >
                <StepIcon className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">{step.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step Content - Scrollable area */}
      <div className="flex-1 overflow-y-auto overscroll-contain pb-20">
        {currentStep === 'checklist' && (
          <div className="p-3">
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
          </div>
        )}

        {currentStep === 'summary' && (
          <div className="p-3 space-y-4">
            <div className="text-center py-4">
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
            
            {!isTaskCompleted && (
              <div className="pt-4 border-t">
                <Button 
                  onClick={handleFinishReport}
                  className="w-full"
                  size="lg"
                  disabled={completionPercentage < 100}
                >
                  <CheckCircle className="mr-2 h-5 w-5" />
                  Finalizar Reporte
                </Button>
                
                {completionPercentage < 100 && (
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Completa todas las tareas obligatorias para finalizar
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fixed Navigation Footer - Always visible at bottom */}
      {currentStep !== 'summary' && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg p-3 z-50 safe-area-pb">
          <div className="flex items-center gap-3 max-w-lg mx-auto">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStepIndex === 0}
              className="flex-1 h-12 text-sm font-medium"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Anterior
            </Button>

            <Button
              onClick={handleNext}
              onTouchEnd={(e) => {
                e.preventDefault();
                if (!(!canProceedToNext() || currentStepIndex === steps.length - 1)) {
                  handleNext();
                }
              }}
              disabled={!canProceedToNext() || currentStepIndex === steps.length - 1}
              className="flex-1 h-12 text-sm font-medium touch-manipulation"
            >
              Siguiente
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          
          {!canProceedToNext() && (
            <p className="text-xs text-center text-muted-foreground mt-2">
              {currentStep === 'checklist' && 'Completa todas las tareas para continuar'}
            </p>
          )}
        </div>
      )}
    </div>
  );
};