
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import { useAdditionalTasks } from '@/hooks/useAdditionalTasks';

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
  
  const {
    createReport,
    createReportAsync,
    updateReport,
    updateReportAsync,
    isCreatingReport,
    isUpdatingReport,
  } = useTaskReports();
  const { completeSubtask } = useAdditionalTasks();
  const processAutomaticConsumption = useProcessAutomaticConsumption();
  const realTaskId = task?.originalTaskId || task?.id || '';
  const { data: existingReport, isLoading: isLoadingReport } = useTaskReport(realTaskId);
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
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const lastScrollTop = useRef(0);
  const accumulatedUpScroll = useRef(0);
  
  // Ref to track if we've already tried to create a report for this task
  const reportCreationAttempted = useRef<string | null>(null);
  const previousTaskIdRef = useRef<string | null>(null);
  
  // CRITICAL FIX: Flag to prevent auto-save from overwriting completed status
  const isCompletingRef = useRef(false);
  

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
      // Reset completion lock when opening a task report
      isCompletingRef.current = false;
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
        reportCreationAttempted.current = realTaskId;
      } else if (!isLoadingReport && !currentReport && !hasStartedTask) {
        // Solo resetear si NO hay reporte cargado localmente y la tarea no ha empezado
        // (evita volver a mostrar la pantalla intermedia durante cargas asíncronas)
        console.log('🔄 TaskReportModal - no existing report found, resetting state');
        setCurrentReport(null);
        setChecklist({});
        setNotes('');
        setReportMedia([]);
        setHasStartedTask(false);
        reportCreationAttempted.current = null;
      } else {
        console.log('⏳ TaskReportModal - preserving local started state while data settles');
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
  }, [open, task, existingReport, isLoadingReport, templates, propertyChecklistAssignment, currentReport, hasStartedTask, realTaskId]);

  // NOTE: Modal close auto-save useEffect moved below where forceSave is defined

  // Sync currentReport only when backend report exists; never clear local freshly-created report
  useEffect(() => {
    if (existingReport?.id) {
      console.log('TaskReportModal - syncing current report with existing:', existingReport.id);
      setCurrentReport(prev => (prev?.id === existingReport.id ? prev : existingReport));
    }
  }, [existingReport?.id]);

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
    const categories = currentTemplate?.checklist_items ?? [];
    if (categories.length === 0) {
      return { isValid: true, missingItems: [], missingPhotos: [] };
    }

    const missingItems: string[] = [];
    const missingPhotos: string[] = [];

    categories.forEach((category) => {
      const items = category?.items ?? [];
      items.forEach((item) => {
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
      missingPhotos,
    };
  }, [checklist, currentTemplate]);

  // Calculate completion percentage
  const completionPercentage = React.useMemo(() => {
    const categories = currentTemplate?.checklist_items ?? [];
    if (categories.length === 0) return 0;

    const totalItems = categories.reduce((acc, category) => acc + (category?.items?.length ?? 0), 0);
    if (totalItems === 0) return 0;

    let fullyCompletedItems = 0;

    categories.forEach((category) => {
      const items = category?.items ?? [];
      items.forEach((item) => {
        const key = `${category.id}.${item.id}`;
        const itemData = checklist[key];

        const isExplicitlyCompleted = itemData?.completed === true;
        const hasRequiredPhoto =
          !item.photo_required ||
          (itemData?.media_urls && Array.isArray(itemData.media_urls) && itemData.media_urls.length > 0);

        if (isExplicitlyCompleted && hasRequiredPhoto) {
          fullyCompletedItems++;
        }
      });
    });

    const percentage = Math.round((fullyCompletedItems / totalItems) * 100);

    // Allow 100% when all required validations pass (requiredValidation handles the strict check)
    return percentage;
  }, [checklist, currentTemplate]);

  // Optimized auto-save hook (after completionPercentage is defined)
  // CRITICAL FIX: Auto-save should NEVER set 'completed' status.
  // The 'completed' status must only be set explicitly via handleComplete.
  const autoSaveData = useMemo(() => ({
    checklist_completed: checklist,
    notes,
    issues_found: [],
    overall_status: isTaskCompleted ? ('completed' as const) : ('in_progress' as const),
  }), [checklist, notes, isTaskCompleted]);

  const { forceSave, isOnline } = useOptimizedAutoSave({
    data: autoSaveData,
    onSave: (data, silent = true) => {
      // CRITICAL FIX: Do NOT auto-save if we're in the middle of completing
      // This prevents the timer-based auto-save from overwriting 'completed' with 'in_progress'
      if (isCompletingRef.current) {
        console.log('🛡️ AutoSave: Blocked during completion flow');
        return;
      }
      if (currentReport) {
        updateReport({ 
          reportId: currentReport.id, 
          updates: data,
          silent 
        });
      }
    },
    reportId: currentReport?.id,
    enabled: hasStartedTask && !!currentReport,
    isCompletingRef,
  });

  // CRITICAL: Auto-save when modal closes to prevent data loss
  // BUT: Skip if we just completed the report (isCompletingRef) to avoid overwriting
  useEffect(() => {
    if (!open && hasStartedTask && currentReport) {
      // CRITICAL FIX: If we just completed, do NOT auto-save (it would overwrite 'completed' with 'in_progress')
      if (isCompletingRef.current) {
        console.log('🛡️ TaskReportModal: Skipping auto-save on close - report was just completed');
        reportCreationAttempted.current = null;
        setHasStartedTask(false);
        return;
      }

      const hasChecklistContent = Object.keys(checklist).length > 0;
      const hasNotesContent = notes && notes.trim().length > 0;
      
      if (hasChecklistContent || hasNotesContent) {
        console.log('💾 TaskReportModal: Auto-saving on modal close', {
          reportId: currentReport.id,
          checklistItems: Object.keys(checklist).length,
          hasNotes: hasNotesContent
        });
        
        // Force save before closing
        forceSave();
      }
      
      // Reset state after saving attempt
      reportCreationAttempted.current = null;
      setHasStartedTask(false);
    } else if (!open) {
      reportCreationAttempted.current = null;
      setHasStartedTask(false);
    }
  }, [open, hasStartedTask, currentReport, checklist, notes, forceSave]);

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
      console.log('✅ Checklist completado, avanzando automáticamente al resumen');
      setTimeout(() => setCurrentStep('summary'), 800);
    }
  }, [completionPercentage, currentStep, isChecklistCompleted, requiredValidation.isValid, hasStartedTask]);

  // Auto-start task when modal opens (skip intermediate "Tarea no iniciada" screen)
  useEffect(() => {
    if (
      open &&
      task &&
      !hasStartedTask &&
      !isLoadingReport &&
      !existingReport &&
      isTaskFromToday &&
      currentCleanerId &&
      reportCreationAttempted.current !== realTaskId
    ) {
      handleStartTask();
    }
  }, [open, task, hasStartedTask, isLoadingReport, existingReport, isTaskFromToday, currentCleanerId, realTaskId]);

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

    if (!currentCleanerId) {
      toast({
        title: "Error",
        description: "No se pudo identificar tu perfil de limpiador. Contacta al administrador.",
        variant: "destructive",
      });
      return;
    }

    if (reportCreationAttempted.current === realTaskId) return;

    console.log('TaskReportModal - starting task and creating report');
    reportCreationAttempted.current = realTaskId;

    const reportData = {
      task_id: realTaskId,
      cleaner_id: currentCleanerId,
      checklist_completed: {},
      notes: '',
      issues_found: [],
      overall_status: 'in_progress' as const,
      start_time: new Date().toISOString(),
    };

    try {
      const created = await createReportAsync(reportData);
      setCurrentReport(created);
      setHasStartedTask(true);
    } catch (error) {
      console.error('❌ Error starting task report:', error);
      reportCreationAttempted.current = null;
      toast({
        title: "Error",
        description: "No se pudo iniciar el reporte. Inténtalo de nuevo.",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    if (!task) return;

    if (!user?.id) {
      const errorMsg = 'Debes estar autenticado para guardar reportes. Por favor, inicia sesión de nuevo.';
      addSaveError(
        'Error de autenticación',
        errorMsg,
        {
          userId: user?.id,
          taskId: task.id,
          hasUser: !!user,
          reportId: currentReport?.id,
        },
        'Intentando guardar reporte sin autenticación'
      );

      toast({
        title: 'Error de autenticación',
        description: errorMsg,
        variant: 'destructive',
      });
      return;
    }

    if (!currentCleanerId) {
      const errorMsg = 'No se pudo identificar tu perfil de limpiador. Contacta al administrador.';
      addSaveError(
        'Error de identificación',
        errorMsg,
        {
          userId: user?.id,
          taskId: task.id,
          currentCleanerId,
          cleanerData: cleaners,
        },
        'Intentando guardar sin ID de limpiador'
      );

      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive',
      });
      return;
    }

    const reportStatusToPersist: 'completed' | 'in_progress' = isTaskCompleted ? 'completed' : 'in_progress';

    const reportData = {
      task_id: realTaskId,
      cleaner_id: currentCleanerId,
      checklist_template_id: currentTemplate?.id,
      checklist_completed: checklist,
      notes,
      issues_found: [],
      overall_status: reportStatusToPersist,
      ...(reportStatusToPersist === 'completed' ? {
        end_time: currentReport?.end_time || new Date().toISOString(),
      } : {}),
    };

    console.log('TaskReportModal - handleSave called with:', {
      currentUser: user?.id,
      currentCleanerId,
      currentReport: currentReport?.id,
      existingReport: existingReport?.id,
      hasStartedTask,
      reportData,
    });

    try {
      // If we have a currentReport with an ID, always UPDATE (even if existingReport query hasn't loaded yet)
      if (currentReport?.id) {
        const updated = await updateReportAsync({
          reportId: currentReport.id,
          updates: reportData,
        });
        setCurrentReport(updated);
      } else if (existingReport?.id) {
        // Fallback: existingReport loaded but currentReport not set
        const updated = await updateReportAsync({
          reportId: existingReport.id,
          updates: reportData,
        });
        setCurrentReport(updated);
      } else {
        const createData = {
          ...reportData,
          start_time: new Date().toISOString(),
        };
        const created = await createReportAsync(createData);
        setCurrentReport(created);
        setHasStartedTask(true);
      }
    } catch (error) {
      console.error('Error saving report:', error);
      const errorMsg = error instanceof Error ? error.message : (typeof error === 'object' && error !== null && 'message' in error) ? String((error as any).message) : 'Error desconocido al guardar reporte';

      addSaveError(
        'Error al guardar reporte',
        errorMsg,
        {
          userId: user?.id,
          taskId: task.id,
          currentCleanerId,
          reportId: currentReport?.id,
          hasCurrentReport: !!currentReport,
          hasExistingReport: !!existingReport,
          completionPercentage,
        },
        'Guardando reporte desde modal'
      );

      toast({
        title: 'Error',
        description: 'No se pudo guardar el reporte. Verifica que estés autenticado e inténtalo de nuevo.',
        variant: 'destructive',
      });
    }
  };

  const handleComplete = async () => {
    if (!task) return;

    // CRITICAL FIX: Set flag IMMEDIATELY to prevent auto-save from overwriting
    isCompletingRef.current = true;

    if (!isTaskFromToday) {
      isCompletingRef.current = false;
      toast({
        title: "Error",
        description: "Solo puedes completar tareas del día de hoy.",
        variant: "destructive",
      });
      return;
    }

    if (!requiredValidation.isValid) {
      isCompletingRef.current = false;
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
      task_id: realTaskId,
      cleaner_id: currentCleanerId,
      checklist_template_id: currentTemplate?.id,
      checklist_completed: checklist,
      notes,
      issues_found: [],
      overall_status: 'completed' as const,
      end_time: new Date().toISOString(),
    };

    try {
      // Step 1: Update/create the report with 'completed' status
      if (currentReport) {
        const updated = await updateReportAsync({
          reportId: currentReport.id,
          updates: reportData,
        });
        setCurrentReport(updated);
        console.log('✅ Report updated to completed:', currentReport.id);
      } else {
        const created = await createReportAsync({
          ...reportData,
          start_time: new Date().toISOString(),
        });
        setCurrentReport(created);
        console.log('✅ Report created as completed:', created.id);
      }

      // Step 2: Update task status to 'completed'
      console.log('🔄 Actualizando estado de la tarea a completed:', realTaskId);
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: updatedTask, error } = await supabase
        .from('tasks')
        .update({ status: 'completed' })
        .eq('id', realTaskId)
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('❌ Error actualizando estado de tarea:', error);
        throw error;
      }

      if (!updatedTask) {
        throw new Error(`No se encontró la tarea ${realTaskId} al completar`);
      }

      console.log('✅ Task updated to completed:', realTaskId);

      // Step 3: Process automatic inventory consumption (non-critical)
      if (task.propertyId) {
        console.log('🔄 Procesando consumo automático de inventario para tarea:', task.id);
        try {
          await processAutomaticConsumption.mutateAsync({
            taskId: task.id,
            propertyId: task.propertyId,
          });
          console.log('✅ Consumo automático procesado correctamente');
        } catch (inventoryError) {
          console.error('⚠️ Error procesando consumo automático (no crítico):', inventoryError);
          toast({
            title: "Advertencia",
            description: "El reporte se completó pero hubo un problema procesando el inventario automáticamente.",
            variant: "destructive",
          });
        }
      }

      // Step 4: Invalidate ALL relevant caches thoroughly
      console.log('🔄 Invalidando todos los caches relevantes...');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['task-reports'] }),
        queryClient.invalidateQueries({ queryKey: ['task-report', realTaskId] }),
        // Invalidate cleaner-specific task queries
        ...(currentCleanerId ? [
          queryClient.invalidateQueries({ queryKey: ['tasks', 'cleaner', currentCleanerId] }),
        ] : []),
      ]);
      console.log('✅ Todos los caches invalidados');

      toast({
        title: "Reporte completado",
        description: "El reporte se ha finalizado exitosamente.",
      });

      // Step 5: Small delay before closing to ensure mutations propagate
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // isCompletingRef stays true - it will be reset in the useEffect when open becomes false
      onOpenChange(false);
    } catch (error) {
      // Reset flag on error to allow retry
      isCompletingRef.current = false;
      
      console.error('Error completing report:', error);
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido al completar reporte';

      addSaveError(
        'Error al completar reporte',
        errorMsg,
        {
          userId: user?.id,
          taskId: task.id,
          currentCleanerId,
          reportId: currentReport?.id,
          completionPercentage,
          hasPropertyId: !!task.propertyId,
        },
        'Completando reporte final'
      );

      toast({
        title: "Error al completar",
        description: "No se pudo completar el reporte. Inténtalo de nuevo.",
        variant: "destructive",
      });
    }
  };

  // Handler for completing additional subtasks from the checklist
  const handleAdditionalTaskComplete = useCallback((
    subtaskId: string, 
    completed: boolean, 
    notesParam?: string, 
    mediaUrls?: string[]
  ) => {
    if (!task) return;
    
    completeSubtask({
      task,
      subtaskId,
      completed,
      notes: notesParam,
      mediaUrls
    });
  }, [task, completeSubtask]);

  // Responsive modal classes - moved BEFORE conditional return
  const getModalClasses = useCallback(() => {
    if (isMobile) {
      return "w-full max-w-full h-full max-h-full m-0 rounded-none overflow-hidden flex flex-col";
    }
    if (isTablet) {
      return "w-[95vw] max-w-3xl h-[85vh] max-h-[85vh] overflow-hidden flex flex-col";
    }
    return "max-w-4xl h-[90vh] max-h-[90vh] overflow-hidden flex flex-col";
  }, [isMobile, isTablet]);

  const handleContentScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (!isMobile) return;
    const scrollTop = e.currentTarget.scrollTop;
    const scrollDelta = scrollTop - lastScrollTop.current;
    
    if (Math.abs(scrollDelta) > 5) {
      if (scrollDelta > 0 && scrollTop > 50) {
        // Scrolling down - collapse header, reset upward accumulator
        setIsHeaderCollapsed(true);
        accumulatedUpScroll.current = 0;
      } else if (scrollDelta < 0) {
        // Scrolling up - accumulate before expanding
        accumulatedUpScroll.current += Math.abs(scrollDelta);
        if (accumulatedUpScroll.current > 80 || scrollTop < 30) {
          setIsHeaderCollapsed(false);
          accumulatedUpScroll.current = 0;
        }
      }
      lastScrollTop.current = scrollTop;
    }
  }, [isMobile]);

  // FIXED: All hooks are now above this conditional return
  if (!task) return null;

  const canComplete = isTaskFromToday && requiredValidation.isValid;


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={getModalClasses()}>
        <DialogHeader className="flex-shrink-0 pb-1">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <TaskReportHeader
                task={task}
                reportStatus={reportStatus}
                completionPercentage={completionPercentage}
                isLoadingReport={isLoadingReport}
                isCollapsed={isMobile && isHeaderCollapsed}
              />
            </div>
            {isMobile && (
              <NetworkStatusIndicator 
                className="ml-2 flex-shrink-0" 
                showText={false}
              />
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0">
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
            onAdditionalTaskComplete={handleAdditionalTaskComplete}
            isHeaderCollapsed={isMobile && isHeaderCollapsed}
            onContentScroll={handleContentScroll}
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
