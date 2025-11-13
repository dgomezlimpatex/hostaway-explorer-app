
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Task } from '@/types/calendar';
import { TaskReport, TaskChecklistTemplate, TaskMedia } from '@/types/taskReports';
import { useTaskReports, useTaskReport, useChecklistTemplates, useTaskMedia } from '@/hooks/useTaskReports';
import { usePropertyChecklistAssignment } from '@/hooks/usePropertyChecklists';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useDeviceType } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import { useCleaners } from '@/hooks/useCleaners';
import { useProcessAutomaticConsumption } from '@/hooks/useAmenityMappings';
import { useOptimizedAutoSave } from '@/hooks/useOptimizedAutoSave';
import { useMobileErrorHandler } from '@/hooks/useMobileErrorHandler';
import { MobileErrorDisplay } from '@/components/mobile/MobileErrorDisplay';
import { TaskReportHeader } from './task-report/TaskReportHeader';
import { TaskReportTabs } from './task-report/TaskReportTabs';
import { TaskReportFooter } from './task-report/TaskReportFooter';
import { NetworkStatusIndicator } from '@/components/ui/network-status-indicator';
import { OfflineSyncIndicator } from '@/components/ui/offline-sync-indicator';

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
  const queryClient = useQueryClient();
  const { isMobile, isTablet } = useDeviceType();
  
  // Mobile error handling
  const { 
    errors: mobileErrors, 
    isVisible: showMobileErrors,
    addSaveError,
    addNetworkError,
    dismissError,
    dismissAllErrors
  } = useMobileErrorHandler();
  
  const { createReport, updateReport, isCreatingReport, isUpdatingReport } = useTaskReports();
  const processAutomaticConsumption = useProcessAutomaticConsumption();
  const { data: existingReport, isLoading: isLoadingReport } = useTaskReport(task?.id || '');
  const { data: templates, isLoading: isLoadingTemplates } = useChecklistTemplates();
  const { data: propertyChecklistAssignment } = usePropertyChecklistAssignment(task?.propertyId || '');
  const { user, userRole } = useAuth();
  const { cleaners } = useCleaners();

  const [currentReport, setCurrentReport] = useState<TaskReport | null>(null);
  const [checklist, setChecklist] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState('');
  const [reportMedia, setReportMedia] = useState<TaskMedia[]>([]);
  const [activeTab, setActiveTab] = useState('checklist');
  const [currentStep, setCurrentStep] = useState<'checklist' | 'media' | 'summary'>('checklist');
  const [currentTemplate, setCurrentTemplate] = useState<TaskChecklistTemplate | undefined>();
  const [hasStartedTask, setHasStartedTask] = useState(false);
  const [isChecklistCompleted, setIsChecklistCompleted] = useState(false);
  
  // Ref to track if we've already tried to create a report for this task
  const reportCreationAttempted = useRef<string | null>(null);
  

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
      console.log('🚀 TaskReportModal - initializing for task:', task.id, {
        hasExistingReport: !!existingReport,
        existingReportId: existingReport?.id,
        isLoadingReport
      });
      
      if (existingReport) {
        console.log('✅ TaskReportModal - loading existing report:', {
          reportId: existingReport.id,
          taskId: existingReport.task_id,
          checklistData: existingReport.checklist_completed,
          issuesCount: existingReport.issues_found?.length || 0,
          notes: existingReport.notes?.substring(0, 50) || 'no notes'
        });
        
        setCurrentReport(existingReport);
        setChecklist(existingReport.checklist_completed || {});
        setNotes(existingReport.notes || '');
        setHasStartedTask(true);
        reportCreationAttempted.current = task.id;
      } else if (!isLoadingReport) {
        // CRITICAL FIX: Only reset if we're sure there's no existing report (not still loading)
        console.log('🔄 TaskReportModal - no existing report found, resetting state');
        setCurrentReport(null);
        setChecklist({});
        setNotes('');
        setReportMedia([]);
        setHasStartedTask(false);
        reportCreationAttempted.current = null;
      } else {
        console.log('⏳ TaskReportModal - still loading existing report, waiting...');
      }

      // Find appropriate template - first check if property has assigned checklist
      if (templates && templates.length > 0) {
        let selectedTemplate: TaskChecklistTemplate | undefined;
        
        // Priority 1: Use checklist assigned to the property
        if (propertyChecklistAssignment?.checklist_template_id) {
          selectedTemplate = templates.find(t => t.id === propertyChecklistAssignment.checklist_template_id);
          if (selectedTemplate) {
            console.log('TaskReportModal - using property assigned template:', selectedTemplate);
          }
        }
        
        // Priority 2: Fallback to property type matching
        if (!selectedTemplate) {
          selectedTemplate = templates.find(t => 
            task.type?.toLowerCase().includes(t.property_type?.toLowerCase())
          );
          if (selectedTemplate) {
            console.log('TaskReportModal - using property type matched template:', selectedTemplate);
          }
        }
        
        // Priority 3: Use first available template
        if (!selectedTemplate) {
          selectedTemplate = templates[0];
          console.log('TaskReportModal - using default first template:', selectedTemplate);
        }
        
        setCurrentTemplate(selectedTemplate);
      }
    }
  }, [open, task, existingReport, templates, propertyChecklistAssignment]);

  // Reset creation tracking when modal closes
  useEffect(() => {
    if (!open) {
      reportCreationAttempted.current = null;
      setHasStartedTask(false);
    }
  }, [open]);

  // Update currentReport when existingReport changes (after creation)
  useEffect(() => {
    if (existingReport) {
      console.log('TaskReportModal - syncing current report with existing:', existingReport.id);
      setCurrentReport(existingReport);
    } else {
      console.log('TaskReportModal - no existing report, clearing current report');
      setCurrentReport(null);
    }
  }, [existingReport]);

  // Update reportMedia when taskMedia changes
  useEffect(() => {
    if (taskMedia && currentReport) {
      const generalMedia = taskMedia.filter(media => !media.checklist_item_id);
      setReportMedia(generalMedia);
      console.log('TaskReportModal - loaded general media:', generalMedia);
    }
  }, [taskMedia, currentReport]);

  // Validate if task is from today - stricter validation
  const isTaskFromToday = useMemo(() => {
    if (!task) return false;
    const today = new Date();
    const taskDate = new Date(task.date + 'T00:00:00');
    return taskDate.toDateString() === today.toDateString();
  }, [task]);

  // Detectar si la tarea está completada
  const reportStatus = currentReport?.overall_status || 'pending';
  const isTaskCompleted = task?.status === 'completed' || reportStatus === 'completed';

  // Validate required items completion
  const requiredValidation = useMemo(() => {
    if (!currentTemplate) return { isValid: true, missingItems: [], missingPhotos: [] };
    
    const missingItems: string[] = [];
    const missingPhotos: string[] = [];
    
    currentTemplate.checklist_items.forEach(category => {
      category.items.forEach(item => {
        const key = `${category.id}.${item.id}`;
        const itemData = checklist[key];
        
        if (item.required && !itemData?.completed) {
          missingItems.push(item.task);
        }
        
        if (item.photo_required && (!itemData?.media_urls || itemData.media_urls.length === 0)) {
          missingPhotos.push(item.task);
        }
      });
    });
    
    return {
      isValid: missingItems.length === 0 && missingPhotos.length === 0,
      missingItems,
      missingPhotos
    };
  }, [checklist, currentTemplate]);

  // Calculate completion percentage - más conservador para evitar completar prematuramente
  const completionPercentage = React.useMemo(() => {
    if (!currentTemplate) return 0;
    
    const totalItems = currentTemplate.checklist_items?.reduce(
      (acc, category) => acc + category.items.length, 
      0
    ) || 0;
    
    if (totalItems === 0) return 0;
    
    // Contar elementos completados de forma más estricta
    let fullyCompletedItems = 0;
    let totalRequiredItems = 0;
    
    currentTemplate.checklist_items.forEach(category => {
      category.items.forEach(item => {
        const key = `${category.id}.${item.id}`;
        const itemData = checklist[key];
        
        // Contar elementos requeridos
        if (item.required) {
          totalRequiredItems++;
        }
        
        // Elemento completado solo si:
        // 1. Está marcado como completado explícitamente
        // 2. Si la foto es requerida, debe tener al menos una foto válida
        // 3. Si tiene notas requeridas, deben estar presentes
        const isExplicitlyCompleted = itemData?.completed === true;
        const hasRequiredPhoto = !item.photo_required || 
          (itemData?.media_urls && Array.isArray(itemData.media_urls) && itemData.media_urls.length > 0);
        
        // Solo contar como completado si cumple TODOS los requisitos
        if (isExplicitlyCompleted && hasRequiredPhoto) {
          fullyCompletedItems++;
        }
      });
    });
    
    // Usar elementos requeridos como base mínima si existen
    const baseItems = totalRequiredItems > 0 ? totalRequiredItems : totalItems;
    const percentage = Math.round((fullyCompletedItems / totalItems) * 100);
    
    // No permitir 100% a menos que TODOS los elementos requeridos estén completados
    if (percentage >= 100 && totalRequiredItems > 0) {
      const requiredCompleted = currentTemplate.checklist_items.reduce((count, category) => {
        return count + category.items.filter(item => {
          if (!item.required) return false;
          const key = `${category.id}.${item.id}`;
          const itemData = checklist[key];
          const isCompleted = itemData?.completed === true;
          const hasRequiredPhoto = !item.photo_required || 
            (itemData?.media_urls && itemData.media_urls.length > 0);
          return isCompleted && hasRequiredPhoto;
        }).length;
      }, 0);
      
      return requiredCompleted === totalRequiredItems ? 100 : Math.min(95, percentage);
    }
    
    return Math.min(percentage, 99); // Never auto-complete at 100% sin validación explícita
  }, [checklist, currentTemplate]);

  // Optimized auto-save hook (after completionPercentage is defined)
  const autoSaveData = useMemo(() => ({
    checklist_completed: checklist,
    notes,
    issues_found: [],
    overall_status: completionPercentage === 100 ? 'completed' as const : 'in_progress' as const,
  }), [checklist, notes, completionPercentage]);

  const { forceSave, isOnline } = useOptimizedAutoSave({
    data: autoSaveData,
    onSave: (data, silent = true) => {
      if (currentReport) {
        updateReport({ 
          reportId: currentReport.id, 
          updates: data,
          silent 
        });
      }
    },
    reportId: currentReport?.id,
    enabled: hasStartedTask && !!currentReport
  });

  // Lógica mejorada para transición de pasos - más conservadora
  useEffect(() => {
    const wasCompleted = isChecklistCompleted;
    const nowCompleted = completionPercentage === 100 && requiredValidation.isValid;
    setIsChecklistCompleted(nowCompleted);
    
    // Solo avanzar automáticamente si:
    // 1. El checklist está realmente 100% completado
    // 2. Todas las validaciones pasan
    // 3. El usuario está en el paso de checklist
    // 4. No es la carga inicial
    if (!wasCompleted && nowCompleted && currentStep === 'checklist' && hasStartedTask) {
      console.log('✅ Checklist completado, avanzando automáticamente');
      setTimeout(() => setCurrentStep('media'), 800); // Más tiempo para evitar clicks accidentales
    }
  }, [completionPercentage, currentStep, isChecklistCompleted, requiredValidation.isValid, hasStartedTask]);


  // Removed old auto-save logic - now handled by useOptimizedAutoSave hook

  const handleStartTask = async () => {
    if (!task || !isTaskFromToday) {
      toast({
        title: "Error",
        description: "Solo puedes iniciar tareas del día de hoy.",
        variant: "destructive",
      });
      return;
    }

    // Verificar que tenemos el ID del limpiador actual
    if (!currentCleanerId) {
      toast({
        title: "Error",
        description: "No se pudo identificar tu perfil de limpiador. Contacta al administrador.",
        variant: "destructive",
      });
      return;
    }

    if (reportCreationAttempted.current !== task.id) {
      console.log('TaskReportModal - starting task and creating report');
      reportCreationAttempted.current = task.id;
      
      // Create report with start time
      const reportData = {
        task_id: task.id,
        cleaner_id: currentCleanerId, // Usar SIEMPRE el ID del limpiador actual para tareas múltiples
        checklist_completed: {},
        notes: '',
        issues_found: [],
        overall_status: 'in_progress' as const,
        start_time: new Date().toISOString(),
      };
      
      createReport(reportData);
      setHasStartedTask(true);
      
      toast({
        title: "Tarea iniciada",
        description: "El reporte se ha iniciado correctamente.",
      });
    }
  };

  const handleSave = async () => {
    if (!task) return;

    // Verificar que el usuario esté autenticado
    if (!user?.id) {
      const errorMsg = 'Debes estar autenticado para guardar reportes. Por favor, inicia sesión de nuevo.';
      addSaveError('Error de autenticación', errorMsg, {
        userId: user?.id,
        taskId: task.id,
        hasUser: !!user,
        reportId: currentReport?.id
      }, 'Intentando guardar reporte sin autenticación');
      
      toast({
        title: "Error de autenticación",
        description: errorMsg,
        variant: "destructive",
      });
      return;
    }

    // Verificar que tenemos el ID del limpiador actual
    if (!currentCleanerId) {
      const errorMsg = 'No se pudo identificar tu perfil de limpiador. Contacta al administrador.';
      addSaveError('Error de identificación', errorMsg, {
        userId: user?.id,
        taskId: task.id,
        currentCleanerId,
        cleanerData: cleaners // Fixed: usar cleaners en lugar de cleaner
      }, 'Intentando guardar sin ID de limpiador');
      
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
      return;
    }

    const reportData = {
      task_id: task.id,
      cleaner_id: currentCleanerId, // Usar SIEMPRE el ID del limpiador actual para tareas múltiples
      checklist_template_id: currentTemplate?.id,
      checklist_completed: checklist,
      notes,
      issues_found: [],
      overall_status: completionPercentage === 100 ? 'completed' as const : 'in_progress' as const,
    };

    console.log('TaskReportModal - handleSave called with:', {
      currentUser: user?.id,
      currentCleanerId,
      currentReport: currentReport?.id,
      existingReport: existingReport?.id,
      hasStartedTask,
      reportData
    });

    try {
      // Si tenemos un currentReport y existingReport coinciden, actualizar
      if (currentReport && existingReport && currentReport.id === existingReport.id) {
        console.log('TaskReportModal - updating existing report:', currentReport.id, reportData);
        updateReport({ 
          reportId: currentReport.id, 
          updates: reportData 
        });
      } else {
        console.log('TaskReportModal - creating new report because:', {
          noCurrentReport: !currentReport,
          noExistingReport: !existingReport,
          mismatch: currentReport?.id !== existingReport?.id
        });
        // Crear el reporte con start_time
        const createData = {
          ...reportData,
          start_time: new Date().toISOString(),
        };
        createReport(createData);
        // Marcar que hemos comenzado la tarea
        setHasStartedTask(true);
      }
    } catch (error) {
      console.error('Error saving report:', error);
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido al guardar reporte';
      
      addSaveError('Error al guardar reporte', errorMsg, {
        userId: user?.id,
        taskId: task.id,
        currentCleanerId,
        reportId: currentReport?.id,
        hasCurrentReport: !!currentReport,
        hasExistingReport: !!existingReport,
        completionPercentage
      }, 'Guardando reporte desde modal');
      
      toast({
        title: "Error",
        description: "No se pudo guardar el reporte. Verifica que estés autenticado e inténtalo de nuevo.",
        variant: "destructive",
      });
    }
  };

  const handleComplete = async () => {
    if (!task) return;

    // Validar que la tarea sea de hoy
    if (!isTaskFromToday) {
      toast({
        title: "Error",
        description: "Solo puedes completar tareas del día de hoy.",
        variant: "destructive",
      });
      return;
    }

    // Validar que todas las tareas obligatorias estén completadas
    if (!requiredValidation.isValid) {
      const messages = [];
      if (requiredValidation.missingItems.length > 0) {
        messages.push(`Tareas pendientes: ${requiredValidation.missingItems.join(', ')}`);
      }
      if (requiredValidation.missingPhotos.length > 0) {
        messages.push(`Fotos requeridas: ${requiredValidation.missingPhotos.join(', ')}`);
      }
      
      toast({
        title: "Reporte incompleto",
        description: messages.join('. '),
        variant: "destructive",
      });
      return;
    }

    const reportData = {
      task_id: task.id,
      cleaner_id: currentCleanerId, // Usar SIEMPRE el ID del limpiador actual para tareas múltiples
      checklist_template_id: currentTemplate?.id,
      checklist_completed: checklist,
      notes,
      issues_found: [],
      overall_status: 'completed' as const,
      end_time: new Date().toISOString(),
    };

    try {
      if (currentReport) {
        await updateReport({ 
          reportId: currentReport.id, 
          updates: reportData 
        });
      } else {
        await createReport({
          ...reportData,
          start_time: new Date().toISOString(),
        });
      }

      // También actualizar el estado de la tarea
      console.log('🔄 Actualizando estado de la tarea a completed:', task.id);
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase
        .from('tasks')
        .update({ status: 'completed' })
        .eq('id', task.id);
      
      if (error) {
        console.error('❌ Error actualizando estado de tarea:', error);
        throw error;
      } else {
        console.log('✅ Estado de tarea actualizado correctamente:', data);
      }

      // Procesar consumo automático de inventario si hay propiedad asociada
      if (task.propertyId) {
        console.log('🔄 Procesando consumo automático de inventario para tarea:', task.id);
        try {
          await processAutomaticConsumption.mutateAsync({
            taskId: task.id,
            propertyId: task.propertyId
          });
          console.log('✅ Consumo automático procesado correctamente');
        } catch (inventoryError) {
          console.error('⚠️ Error procesando consumo automático (no crítico):', inventoryError);
          // No lanzamos el error para que no bloquee la finalización del reporte
          toast({
            title: "Advertencia",
            description: "El reporte se completó pero hubo un problema procesando el inventario automáticamente.",
            variant: "destructive",
          });
        }
      }
      
      // Invalidar cache de tareas para que se recargue en el dashboard
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      console.log('🔄 Cache de tareas invalidado');
      
      toast({
        title: "Reporte completado",
        description: "El reporte se ha finalizado exitosamente.",
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error completing report:', error);
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido al completar reporte';
      
      addSaveError('Error al completar reporte', errorMsg, {
        userId: user?.id,
        taskId: task.id,
        currentCleanerId,
        reportId: currentReport?.id,
        completionPercentage,
        hasPropertyId: !!task.propertyId
      }, 'Completando reporte final');
      
      toast({
        title: "Error al completar",
        description: "No se pudo completar el reporte. Inténtalo de nuevo.",
        variant: "destructive",
      });
    }
  };

  if (!task) return null;

  const canComplete = isTaskFromToday && requiredValidation.isValid;

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
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <TaskReportHeader
                task={task}
                reportStatus={reportStatus}
                completionPercentage={completionPercentage}
                isLoadingReport={isLoadingReport}
              />
            </div>
            {isMobile && (
              <NetworkStatusIndicator 
                className="ml-2" 
                showText={false}
              />
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          <TaskReportTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            currentStep={currentStep}
            onStepChange={setCurrentStep}
            isLoadingTemplates={isLoadingTemplates}
            currentTemplate={currentTemplate}
            checklist={checklist}
            onChecklistChange={setChecklist}
            reportId={currentReport?.id}
            notes={notes}
            onNotesChange={setNotes}
            task={task}
            completionPercentage={completionPercentage}
            reportMedia={reportMedia}
            onReportMediaChange={setReportMedia}
            isTaskCompleted={isTaskCompleted}
            hasStartedTask={hasStartedTask}
            onComplete={handleComplete}
            currentReport={currentReport}
          />
        </div>

        <div className="flex-shrink-0">
          <div className="space-y-2">
            {/* Indicador de sincronización offline para móvil */}
            {isMobile && (
              <OfflineSyncIndicator className="mx-4" />
            )}
            
            <TaskReportFooter
              onCancel={() => onOpenChange(false)}
              onSave={handleSave}
              onComplete={handleComplete}
              onStartTask={handleStartTask}
              canComplete={canComplete}
              isCreatingReport={isCreatingReport}
              isUpdatingReport={isUpdatingReport}
              completionPercentage={completionPercentage}
              requiredValidation={requiredValidation}
              isTaskFromToday={isTaskFromToday}
              isTaskCompleted={isTaskCompleted}
              hasStartedTask={hasStartedTask}
              currentStep={currentStep}
            />
          </div>
        </div>
      </DialogContent>

      {/* Mobile Error Display */}
      {isMobile && showMobileErrors && (
        <MobileErrorDisplay
          errors={mobileErrors}
          onDismiss={dismissError}
          onDismissAll={dismissAllErrors}
        />
      )}
    </Dialog>
  );
};
