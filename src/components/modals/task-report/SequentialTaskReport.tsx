import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckSquare, AlertTriangle, Camera, CheckCircle, Clock, ArrowLeft, ArrowRight } from 'lucide-react';
import { Task } from '@/types/calendar';
import { TaskChecklistTemplate, TaskMedia, TaskReport } from '@/types/taskReports';
import { ChecklistSection } from './ChecklistSection';
import { MediaCapture } from './MediaCapture';
import { IssuesSection } from './IssuesSection';
import { ReportSummary } from './ReportSummary';
import { useDeviceType } from '@/hooks/use-mobile';
import { useMobileErrorHandler } from '@/hooks/useMobileErrorHandler';

interface SequentialTaskReportProps {
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
  currentReport?: TaskReport;
}

export const SequentialTaskReport: React.FC<SequentialTaskReportProps> = ({
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
  currentReport,
}) => {
  const { isMobile } = useDeviceType();
  const { addError } = useMobileErrorHandler();

  const steps = [
    { key: 'checklist', title: 'Lista de Tareas', icon: CheckSquare, description: 'Completa todas las tareas del checklist' },
    { key: 'issues', title: 'Incidencias', icon: AlertTriangle, description: 'Reporta cualquier problema encontrado' },
    { key: 'media', title: 'Fotos', icon: Camera, description: 'Sube fotos del trabajo realizado' },
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
        case 'issues':
          return true; // Siempre se puede proceder (aunque no haya incidencias)
        case 'media':
          return reportMedia.length > 0;
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
    <div className="flex flex-col h-full">
      {/* Step Content */}
      <div className={`flex-1 ${currentStep === 'checklist' ? 'min-h-0' : 'min-h-[500px]'} ${currentStep === 'checklist' ? '' : 'overflow-auto'}`}>
        {currentStep === 'checklist' && (
          <div className="space-y-4 h-[60vh] overflow-y-auto">
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
          </div>
        )}

        {currentStep === 'issues' && (
          <div className="space-y-4">
            <div className="text-center py-6">
              <AlertTriangle className="h-12 w-12 text-orange-500 mx-auto mb-3" />
              <h4 className="text-lg font-semibold mb-2">¿Encontraste algún problema?</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Reporta cualquier incidencia o problema durante la limpieza
              </p>
            </div>
            <IssuesSection
              issues={issues}
              onIssuesChange={onIssuesChange}
              reportId={reportId}
              isReadOnly={false}
            />
            
          </div>
        )}

        {currentStep === 'media' && (
          <div className="space-y-4 min-h-[400px]">
            <div className="text-center py-6">
              <Camera className="h-12 w-12 text-blue-500 mx-auto mb-3" />
              <h4 className="text-lg font-semibold mb-2">Sube fotos del trabajo</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Documenta el trabajo realizado con fotos
              </p>
            </div>
            <MediaCapture
              onMediaCaptured={(mediaUrl) => {
                console.log('✅ CRITICAL: Media captured in SequentialTaskReport:', mediaUrl);
                // CRITICAL FIX: Agregar la nueva media al estado reportMedia
                if (reportId) {
                  // Crear objeto media temporal hasta que se recargue desde la DB
                  const newMedia = {
                    id: `temp-${Date.now()}`,
                    file_url: mediaUrl,
                    media_type: 'photo' as const,
                    task_report_id: reportId,
                    timestamp: new Date().toISOString(),
                    created_at: new Date().toISOString()
                  };
                  onReportMediaChange([...reportMedia, newMedia]);
                }
              }}
              onMediaDeleted={(mediaId) => {
                console.log('🗑️ Media deleted in SequentialTaskReport:', mediaId);
                const updatedMedia = reportMedia.filter(media => media.id !== mediaId);
                onReportMediaChange(updatedMedia);
              }}
              reportId={reportId}
              existingMedia={reportMedia}
              isReadOnly={false}
            />
          </div>
        )}

        {currentStep === 'summary' && (
          <div className="space-y-4">
            <div className="text-center py-6">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <h4 className="text-lg font-semibold mb-2">Resumen Final</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Revisa el reporte antes de finalizarlo
              </p>
            </div>
            <ReportSummary
              task={task}
              template={currentTemplate}
              checklist={checklist}
              issues={issues}
              notes={notes}
              completionPercentage={completionPercentage}
              currentReport={currentReport}
            />
            
            {!isTaskCompleted && (
              <div className="pt-6 border-t">
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
                  <p className="text-sm text-muted-foreground text-center mt-2">
                    Completa todas las tareas obligatorias para finalizar
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation Footer */}
      {currentStep !== 'summary' && (
        <div className="border-t pt-2 mt-2 flex-shrink-0">
          <div className="flex justify-between items-center mb-2">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStepIndex === 0}
              className="flex items-center text-xs h-8 px-3"
              size="sm"
            >
              <ArrowLeft className="mr-1 h-3 w-3" />
              Anterior
            </Button>

            <Button
              onClick={(e) => {
                console.log('🖱️ Next button clicked:', {
                  currentStep,
                  disabled: !canProceedToNext() || currentStepIndex === steps.length - 1,
                  canProceed: canProceedToNext(),
                  currentStepIndex,
                  isLastStep: currentStepIndex === steps.length - 1,
                  event: e.type,
                  target: e.target
                });
                handleNext();
              }}
              onTouchEnd={(e) => {
                // ANDROID FIX: Fallback para problemas de touch en Android
                console.log('📱 Touch end event on Next button');
                e.preventDefault();
                if (!(!canProceedToNext() || currentStepIndex === steps.length - 1)) {
                  handleNext();
                }
              }}
              disabled={!canProceedToNext() || currentStepIndex === steps.length - 1}
              className="flex items-center text-xs h-8 px-3 touch-manipulation"
              size="sm"
            >
              Siguiente
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
          
          {!canProceedToNext() && (
            <div className="text-center">
              {currentStep === 'checklist' && (
                <p className="text-xs text-muted-foreground">
                  Completa todas las tareas para continuar
                </p>
              )}
              {currentStep === 'media' && (
                <p className="text-xs text-muted-foreground">
                  Sube al menos una foto para continuar
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};