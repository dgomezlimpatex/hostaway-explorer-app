
import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Camera, FileText, CheckCircle, AlertTriangle, ListTodo, ChevronDown, ChevronUp, MessageSquare, ArrowDown } from 'lucide-react';
import { TaskChecklistTemplate, ChecklistCategory, ChecklistItem } from '@/types/taskReports';
import { AdditionalTask, Task } from '@/types/calendar';
import { MediaCapture } from './MediaCapture';
import { cn } from '@/lib/utils';
import { useTaskReports } from '@/hooks/useTaskReports';
import { useToast } from '@/hooks/use-toast';
import { compressImage, shouldCompressImage } from '@/utils/imageCompression';

interface ChecklistSectionProps {
  template: TaskChecklistTemplate | undefined;
  checklist: Record<string, any>;
  onChecklistChange: (checklist: Record<string, any>) => void;
  reportId?: string;
  isReadOnly?: boolean;
  task?: Task;
  onAdditionalTaskComplete?: (subtaskId: string, completed: boolean, notes?: string, mediaUrls?: string[]) => void;
}

export const ChecklistSection: React.FC<ChecklistSectionProps> = ({
  template,
  checklist,
  onChecklistChange,
  reportId,
  isReadOnly = false,
  task,
  onAdditionalTaskComplete,
}) => {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const { uploadMediaAsync } = useTaskReports();
  const { toast } = useToast();
  const latestReportIdRef = useRef<string | undefined>(reportId);
  // CRITICAL: Ref to always have the latest checklist for concurrent uploads
  const checklistRef = useRef(checklist);
  useEffect(() => { checklistRef.current = checklist; }, [checklist]);
  // Hidden file input refs for auto-opening camera/gallery on photo-required tasks
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  // Refs for each task item DOM element (for scroll-to-incomplete)
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Initialize ALL categories as expanded by default
  const allCategoryIds = useMemo(() => {
    const ids = new Set<string>(['additional']);
    template?.checklist_items.forEach(cat => ids.add(cat.id));
    return ids;
  }, [template]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  
  // Sync expanded categories when template loads
  useEffect(() => {
    setExpandedCategories(prev => {
      const merged = new Set(prev);
      allCategoryIds.forEach(id => merged.add(id));
      return merged;
    });
  }, [allCategoryIds]);

  useEffect(() => {
    latestReportIdRef.current = reportId;
  }, [reportId]);

  const waitForReportId = useCallback(async (maxRetries = 12, delayMs = 250): Promise<string | null> => {
    if (latestReportIdRef.current) return latestReportIdRef.current;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      if (latestReportIdRef.current) return latestReportIdRef.current;
    }

    return null;
  }, []);

  // Get additional tasks from task
  const additionalTasks = task?.additionalTasks || [];
  const pendingAdditionalTasks = additionalTasks.filter(t => !t.completed).length;

  const handleItemToggle = (categoryId: string, itemId: string, completed: boolean) => {
    if (isReadOnly) return;
    
    const key = `${categoryId}.${itemId}`;
    const latest = checklistRef.current;
    const newChecklist = { ...latest };
    
    if (completed) {
      newChecklist[key] = {
        completed: true,
        notes: latest[key]?.notes || '',
        media_urls: latest[key]?.media_urls || [],
      };
    } else {
      delete newChecklist[key];
    }
    
    checklistRef.current = newChecklist;
    onChecklistChange(newChecklist);
  };

  const handleNotesChange = (categoryId: string, itemId: string, notes: string) => {
    if (isReadOnly) return;
    
    const key = `${categoryId}.${itemId}`;
    const latest = checklistRef.current;
    const newChecklist = { ...latest };
    
    if (!newChecklist[key]) {
      newChecklist[key] = { completed: false, notes: '', media_urls: [] };
    }
    
    newChecklist[key].notes = notes;
    checklistRef.current = newChecklist;
    onChecklistChange(newChecklist);
  };

  const handleMediaAdded = (categoryId: string, itemId: string, mediaUrl: string) => {
    if (isReadOnly) return;
    
    const key = `${categoryId}.${itemId}`;
    // CRITICAL: Use ref to get latest state, prevents race condition with concurrent uploads
    const latest = checklistRef.current;
    const newChecklist = { ...latest };
    
    if (!newChecklist[key]) {
      const currentCompleted = latest[key]?.completed || false;
      newChecklist[key] = { completed: currentCompleted, notes: '', media_urls: [] };
    }
    
    const currentMediaUrls = newChecklist[key].media_urls || [];
    newChecklist[key].media_urls = [...currentMediaUrls, mediaUrl];
    
    checklistRef.current = newChecklist;
    onChecklistChange(newChecklist);
  };

  const handleAdditionalTaskToggle = (subtask: AdditionalTask, completed: boolean) => {
    if (isReadOnly || !onAdditionalTaskComplete) return;
    
    const key = `additional.${subtask.id}`;
    const itemData = checklistRef.current[key];
    
    onAdditionalTaskComplete(
      subtask.id, 
      completed, 
      itemData?.notes || '',
      itemData?.media_urls || []
    );
  };

  const handleAdditionalTaskNotesChange = (subtaskId: string, notes: string) => {
    if (isReadOnly) return;
    
    const key = `additional.${subtaskId}`;
    const latest = checklistRef.current;
    const newChecklist = { ...latest };
    
    if (!newChecklist[key]) {
      newChecklist[key] = { notes: '', media_urls: [] };
    }
    
    newChecklist[key].notes = notes;
    checklistRef.current = newChecklist;
    onChecklistChange(newChecklist);
  };

  const handleAdditionalTaskMediaAdded = (subtaskId: string, mediaUrl: string) => {
    if (isReadOnly) return;
    
    const key = `additional.${subtaskId}`;
    const latest = checklistRef.current;
    const newChecklist = { ...latest };
    
    if (!newChecklist[key]) {
      newChecklist[key] = { notes: '', media_urls: [] };
    }
    
    const currentMediaUrls = newChecklist[key].media_urls || [];
    newChecklist[key].media_urls = [...currentMediaUrls, mediaUrl];
    
    checklistRef.current = newChecklist;
    onChecklistChange(newChecklist);
  };

  const toggleExpanded = (key: string) => {
    setExpandedItem(prev => prev === key ? null : key);
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  // Get all incomplete item keys for scroll-to functionality
  const getIncompleteItems = useCallback(() => {
    const incomplete: { key: string; categoryId: string; task: string }[] = [];
    
    template?.checklist_items.forEach((category) => {
      category.items.forEach((item) => {
        const key = `${category.id}.${item.id}`;
        const itemData = checklist[key];
        const isCompleted = itemData?.completed;
        const needsPhoto = item.photo_required && (!itemData?.media_urls || itemData.media_urls.length === 0);
        
        if (!isCompleted || needsPhoto) {
          incomplete.push({ key, categoryId: category.id, task: item.task });
        }
      });
    });

    // Additional tasks
    additionalTasks.forEach((subtask) => {
      if (!subtask.completed) {
        incomplete.push({ key: `additional.${subtask.id}`, categoryId: 'additional', task: subtask.text });
      }
    });

    return incomplete;
  }, [template, checklist, additionalTasks]);

  const scrollToNextIncomplete = useCallback(() => {
    const incomplete = getIncompleteItems();
    if (incomplete.length === 0) return;

    const first = incomplete[0];
    
    // Expand the category if collapsed
    setExpandedCategories(prev => {
      const next = new Set(prev);
      next.add(first.categoryId);
      return next;
    });

    // Scroll to the element after a tick (to let category expand)
    setTimeout(() => {
      const el = itemRefs.current[first.key];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Flash highlight
        el.classList.add('ring-2', 'ring-primary', 'ring-offset-1');
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-primary', 'ring-offset-1');
        }, 2000);
      }
    }, 150);
  }, [getIncompleteItems]);

  // Calculate totals
  const totalItems = (template?.checklist_items.reduce((acc, cat) => acc + cat.items.length, 0) || 0) + additionalTasks.length;
  const completedItems = Object.keys(checklist).filter(k => checklist[k]?.completed).length + additionalTasks.filter(t => t.completed).length;

  if (!template && additionalTasks.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
        <p className="text-muted-foreground">No hay plantilla de checklist disponible</p>
      </div>
    );
  }

  // Count completed items per category
  const getCategoryProgress = (category: ChecklistCategory) => {
    const total = category.items.length;
    const done = category.items.filter(item => {
      const key = `${category.id}.${item.id}`;
      return checklist[key]?.completed;
    }).length;
    return { total, done };
  };

  return (
    <div className="space-y-2">
      {/* Compact header */}
      <div className="flex items-center justify-between px-1 pb-1">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-semibold truncate text-foreground">
            {template?.template_name || 'Checklist'}
          </h3>
          {isReadOnly && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Lectura</Badge>}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs font-bold text-primary">{completedItems}</span>
          <span className="text-xs text-muted-foreground">/</span>
          <span className="text-xs text-muted-foreground">{totalItems}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden mx-1">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${totalItems > 0 ? (completedItems / totalItems) * 100 : 0}%` }}
        />
      </div>

      {/* Additional Tasks Section - Highlighted at top */}
      {additionalTasks.length > 0 && (
        <div className="mx-0.5 rounded-xl border-2 border-orange-200 bg-orange-50/60 overflow-hidden">
          <button
            onClick={() => toggleCategory('additional')}
            className="w-full flex items-center justify-between px-3 py-2.5 text-left"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-semibold text-orange-700">Tareas Adicionales</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge 
                variant={pendingAdditionalTasks > 0 ? "destructive" : "secondary"}
                className={cn("text-[10px]", pendingAdditionalTasks === 0 && "bg-green-100 text-green-700 border-green-200")}
              >
                {pendingAdditionalTasks > 0 ? `${pendingAdditionalTasks} pend.` : '✓'}
              </Badge>
              {expandedCategories.has('additional') ? <ChevronUp className="h-4 w-4 text-orange-400" /> : <ChevronDown className="h-4 w-4 text-orange-400" />}
            </div>
          </button>

          {expandedCategories.has('additional') && (
            <div className="px-2 pb-2 space-y-1.5">
              {additionalTasks.map((subtask) => {
                const key = `additional.${subtask.id}`;
                const itemData = checklist[key];
                const isCompleted = subtask.completed;
                const isExpanded = expandedItem === key;
                const hasNotes = itemData?.notes || subtask.notes;
                const hasMedia = (itemData?.media_urls?.length > 0) || (subtask.mediaUrls?.length > 0);

                return (
                  <div key={subtask.id} className="space-y-0">
                    {/* Task button */}
                    <button
                      onClick={() => {
                        if (!isReadOnly) {
                          handleAdditionalTaskToggle(subtask, !isCompleted);
                        }
                      }}
                      disabled={isReadOnly}
                      className={cn(
                        "w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200 flex items-start gap-2.5 touch-manipulation active:scale-[0.98]",
                        isCompleted
                          ? "bg-green-100/80 border border-green-200"
                          : "bg-white border border-orange-200 shadow-sm active:bg-orange-50"
                      )}
                    >
                      {/* Status indicator */}
                      <div className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors",
                        isCompleted ? "bg-green-500" : "border-2 border-orange-300"
                      )}>
                        {isCompleted && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm leading-snug",
                          isCompleted ? "text-green-700 line-through" : "text-slate-800 font-medium"
                        )}>
                          {subtask.text}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {subtask.photoRequired && (
                            <span className="inline-flex items-center text-[10px] text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full">
                              <Camera className="h-2.5 w-2.5 mr-0.5" />Foto
                            </span>
                          )}
                          {hasNotes && <MessageSquare className="h-3 w-3 text-muted-foreground" />}
                          {hasMedia && <Camera className="h-3 w-3 text-blue-500" />}
                        </div>
                      </div>
                    </button>

                    {/* Expandable details - only on tap of expand icon */}
                    <div className="flex justify-end px-1 -mt-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleExpanded(key); }}
                        className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1"
                      >
                        {isExpanded ? 'Cerrar' : 'Detalles'}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="px-2 pb-2 space-y-2 animate-in slide-in-from-top-1 duration-200">
                        <Textarea
                          placeholder="Notas (opcional)"
                          value={itemData?.notes || subtask.notes || ''}
                          onChange={(e) => handleAdditionalTaskNotesChange(subtask.id, e.target.value)}
                          className="min-h-[50px] text-sm resize-none"
                          disabled={isReadOnly}
                        />
                        {subtask.photoRequired && (
                          <MediaCapture
                            onMediaCaptured={(mediaUrl) => handleAdditionalTaskMediaAdded(subtask.id, mediaUrl)}
                            reportId={reportId}
                            checklistItemId={key}
                            existingMedia={itemData?.media_urls || subtask.mediaUrls || []}
                            isReadOnly={isReadOnly}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Regular checklist categories */}
      {template?.checklist_items.map((category: ChecklistCategory) => {
        const { total, done } = getCategoryProgress(category);
        const isCategoryOpen = expandedCategories.has(category.id);
        const allDone = done === total;

        return (
          <div key={category.id} className="mx-0.5 rounded-xl border border-border/60 bg-card overflow-hidden">
            {/* Category header - collapsible */}
            <button
              onClick={() => toggleCategory(category.id)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors",
                allDone && "bg-green-50/50"
              )}
            >
              <span className={cn(
                "text-sm font-semibold truncate",
                allDone ? "text-green-700" : "text-foreground"
              )}>
                {category.category}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={cn(
                  "text-[11px] font-medium px-2 py-0.5 rounded-full",
                  allDone 
                    ? "bg-green-100 text-green-700" 
                    : "bg-muted text-muted-foreground"
                )}>
                  {done}/{total}
                </span>
                {isCategoryOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </button>

            {/* Items list */}
            {isCategoryOpen && (
              <div className="px-2 pb-2 space-y-1">
                {category.items.map((item: ChecklistItem) => {
                  const key = `${category.id}.${item.id}`;
                  const itemData = checklist[key];
                  const isCompleted = itemData?.completed || false;
                  const isExpanded = expandedItem === key;
                  const hasNotes = itemData?.notes;
                  const hasMedia = itemData?.media_urls?.length > 0;

                  return (
                    <div key={item.id} ref={(el) => { itemRefs.current[key] = el; }} className="transition-all duration-300 rounded-lg">
                      {/* Hidden file input for auto-opening camera on photo-required tasks */}
                      {item.photo_required && !isReadOnly && (
                        <input
                          ref={(el) => { fileInputRefs.current[key] = el; }}
                          type="file"
                          accept="image/*,video/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) {
                              if (e.target) e.target.value = '';
                              return;
                            }

                            console.log('📸 Auto-capture file selected:', file.name, file.size);
                            setExpandedItem(key);

                            const resolvedReportId = reportId || await waitForReportId();
                            if (!resolvedReportId) {
                              toast({
                                title: "No se pudo subir la foto",
                                description: "El reporte aún no está listo. Espera 2-3 segundos e inténtalo de nuevo.",
                                variant: "destructive"
                              });
                              if (e.target) e.target.value = '';
                              return;
                            }

                            try {
                              // Compress if needed
                              let fileToUpload = file;
                              if (shouldCompressImage(file)) {
                                try {
                                  fileToUpload = await compressImage(file);
                                } catch {
                                  fileToUpload = file;
                                }
                              }

                              const data = await uploadMediaAsync({
                                file: fileToUpload,
                                reportId: resolvedReportId,
                                checklistItemId: key,
                              });

                              console.log('✅ Auto-capture upload success:', data);
                              handleMediaAdded(category.id, item.id, data.file_url);
                              // Auto-mark as completed now that photo evidence exists
                              handleItemToggle(category.id, item.id, true);
                              toast({ title: "Foto subida", description: "Evidencia guardada correctamente" });
                            } catch (error) {
                              console.error('❌ Auto-capture upload failed:', error);
                              toast({ title: "Error al subir foto", description: "Inténtalo de nuevo", variant: "destructive" });
                            } finally {
                              if (e.target) e.target.value = '';
                            }
                          }}
                          style={{ position: 'absolute', left: '-9999px', opacity: 0 }}
                          aria-hidden="true"
                        />
                      )}

                      {/* Tappable task row */}
                      <button
                        onClick={() => {
                          if (isReadOnly) return;
                          
                          if (!isCompleted) {
                            // Mark as completed
                            handleItemToggle(category.id, item.id, true);
                            // If photo required and no photo yet, auto-open the details panel for photo capture
                            if (item.photo_required && !hasMedia) {
                              setExpandedItem(key);
                              // Small delay to let state update, then trigger file input
                              setTimeout(() => {
                                fileInputRefs.current[key]?.click();
                              }, 100);
                            }
                          } else {
                            // Unmark
                            handleItemToggle(category.id, item.id, false);
                          }
                        }}
                        disabled={isReadOnly}
                        className={cn(
                          "w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200 flex items-start gap-2.5 touch-manipulation active:scale-[0.98]",
                          isCompleted
                            ? "bg-green-50 border border-green-100"
                            : "bg-muted/30 border border-transparent hover:bg-muted/50 active:bg-muted/70"
                        )}
                      >
                        {/* Circular status indicator */}
                        <div className={cn(
                          "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-300",
                          isCompleted 
                            ? "bg-green-500 shadow-sm shadow-green-200" 
                            : "border-2 border-slate-300"
                        )}>
                          {isCompleted && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm leading-snug",
                            isCompleted ? "text-green-700/70 line-through" : "text-foreground"
                          )}>
                            {item.task}
                          </p>
                          
                          {/* Inline indicators */}
                          {(item.required || item.photo_required || hasNotes || hasMedia) && (
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {item.required && !isCompleted && (
                                <span className="inline-flex items-center text-[10px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full font-medium">
                                  Requerido
                                </span>
                              )}
                              {item.photo_required && (
                                <span className={cn(
                                  "inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                                  hasMedia 
                                    ? "text-blue-600 bg-blue-50" 
                                    : "text-amber-700 bg-amber-100 animate-pulse"
                                )}>
                                  <Camera className="h-2.5 w-2.5 mr-0.5" />
                                  {hasMedia ? `${itemData.media_urls.length} foto(s)` : '📷 Foto obligatoria'}
                                </span>
                              )}
                              {hasNotes && <MessageSquare className="h-3 w-3 text-muted-foreground" />}
                            </div>
                          )}
                        </div>
                      </button>

                      {/* Inline photo capture - shown when photo required and has media or expanded */}
                      {item.photo_required && (hasMedia || isExpanded) && (
                        <div className="px-2 py-1.5">
                          <MediaCapture
                            onMediaCaptured={(mediaUrl) => {
                              handleMediaAdded(category.id, item.id, mediaUrl);
                              // Auto-mark completed when photo is added via MediaCapture buttons
                              if (!isCompleted) {
                                handleItemToggle(category.id, item.id, true);
                              }
                            }}
                            reportId={reportId}
                            checklistItemId={key}
                            existingMedia={itemData?.media_urls || []}
                            isReadOnly={isReadOnly}
                          />
                        </div>
                      )}

                      {/* Notes expand toggle - only if has notes already (hidden for photo-required items) */}
                      {!item.photo_required && (hasNotes || isExpanded) && (
                        <div className="px-2 pb-1.5">
                          {!isExpanded && hasNotes ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleExpanded(key); }}
                              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                            >
                              <MessageSquare className="h-3 w-3" /> Ver notas
                            </button>
                          ) : isExpanded ? (
                            <div className="space-y-1 animate-in slide-in-from-top-1 duration-200">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] text-muted-foreground">Notas</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleExpanded(key); }}
                                  className="text-[10px] text-muted-foreground hover:text-foreground"
                                >
                                  Cerrar
                                </button>
                              </div>
                              <Textarea
                                placeholder="Notas (opcional)"
                                value={itemData?.notes || ''}
                                onChange={(e) => handleNotesChange(category.id, item.id, e.target.value)}
                                className="min-h-[40px] text-sm resize-none"
                                disabled={isReadOnly}
                              />
                            </div>
                          ) : null}
                        </div>
                      )}

                      {/* Add notes link when no notes exist and not expanded (hidden for photo-required items) */}
                      {!item.photo_required && !hasNotes && !isExpanded && !isReadOnly && (
                        <div className="flex justify-end px-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleExpanded(key); }}
                            className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground px-1 py-0.5"
                          >
                            + nota
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Floating "find incomplete" button */}
      {(() => {
        const incomplete = getIncompleteItems();
        if (incomplete.length === 0 || isReadOnly) return null;
        return (
          <button
            onClick={scrollToNextIncomplete}
            className={cn(
              "sticky bottom-2 mx-auto flex items-center gap-1.5 px-4 py-2 rounded-full",
              "bg-primary text-primary-foreground shadow-lg shadow-primary/25",
              "text-xs font-semibold touch-manipulation active:scale-95 transition-transform",
              "animate-in fade-in slide-in-from-bottom-2 duration-300"
            )}
          >
            <ArrowDown className="h-3.5 w-3.5" />
            {incomplete.length === 1 
              ? 'Falta 1 tarea' 
              : `Faltan ${incomplete.length} tareas`}
          </button>
        );
      })()}
    </div>
  );
};
