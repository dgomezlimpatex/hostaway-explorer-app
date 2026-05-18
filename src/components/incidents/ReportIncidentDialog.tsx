import React, { useState, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Camera, Image as ImageIcon, Loader2, Trash2, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIncidentCategories, useCreateIncident } from '@/hooks/useCleaningIncidents';
import { useAuth } from '@/hooks/useAuth';

interface ReportIncidentDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  taskId: string;
  propertyName?: string;
}

type Step = 'category' | 'location' | 'description' | 'media';
const STEPS: Step[] = ['category', 'location', 'description', 'media'];

export const ReportIncidentDialog: React.FC<ReportIncidentDialogProps> = ({
  open,
  onOpenChange,
  taskId,
  propertyName,
}) => {
  const { userRole } = useAuth();
  const isPrivileged = userRole === 'admin';
  const { data: categories = [], isLoading: loadingCats } = useIncidentCategories();
  const createIncident = useCreateIncident();

  const [step, setStep] = useState<Step>('category');
  const [categoryId, setCategoryId] = useState<string>('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [publishDirect, setPublishDirect] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('category');
    setCategoryId('');
    setLocation('');
    setDescription('');
    setFiles([]);
    setPublishDirect(false);
  };

  const handleClose = (v: boolean) => {
    if (!v && !createIncident.isPending) reset();
    onOpenChange(v);
  };

  const stepIndex = STEPS.indexOf(step);

  const canAdvance = useMemo(() => {
    switch (step) {
      case 'category': return !!categoryId;
      case 'location': return true; // opcional
      case 'description': return description.trim().length >= 5;
      case 'media': return files.length >= 2;
    }
  }, [step, categoryId, description, files]);

  const goNext = () => {
    if (!canAdvance) return;
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next);
  };
  const goBack = () => {
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev);
  };

  const handleFiles = (selected: FileList | null) => {
    if (!selected) return;
    const arr = Array.from(selected).filter((f) =>
      f.type.startsWith('image/') || f.type.startsWith('video/')
    );
    setFiles((prev) => [...prev, ...arr].slice(0, 10));
  };

  const removeFile = (idx: number) => setFiles((p) => p.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (files.length < 2) return;
    try {
      await createIncident.mutateAsync({
        taskId,
        categoryId,
        description: description.trim(),
        location: location.trim() || undefined,
        files,
        createAsOpen: isPrivileged && publishDirect,
      });
      handleClose(false);
    } catch {
      /* toast handled in hook */
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg p-0 gap-0 max-h-[90vh] flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-orange-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base">Reportar incidencia</DialogTitle>
              <DialogDescription className="text-xs truncate">
                {propertyName || 'Tarea en curso'}
              </DialogDescription>
            </div>
          </div>
          {/* progress */}
          <div className="flex items-center gap-1 mt-3">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  i <= stepIndex ? 'bg-primary' : 'bg-border'
                )}
              />
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === 'category' && (
            <div className="space-y-3">
              <Label className="text-sm">Categoría</Label>
              <Select value={categoryId} onValueChange={setCategoryId} disabled={loadingCats}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder={loadingCats ? 'Cargando…' : 'Selecciona una categoría'} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Elige el tipo de problema que quieres reportar.
              </p>
            </div>
          )}

          {step === 'location' && (
            <div className="space-y-3">
              <Label className="text-sm">Ubicación (opcional)</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ej: baño principal, cocina, salón…"
                className="h-12"
              />
              <p className="text-xs text-muted-foreground">
                Indica dónde está el problema dentro de la propiedad.
              </p>
            </div>
          )}

          {step === 'description' && (
            <div className="space-y-3">
              <Label className="text-sm">Descripción</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe el problema con detalle…"
                className="min-h-[140px]"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Mínimo 5 caracteres. Sé claro para que el cliente entienda el problema.
              </p>
            </div>
          )}

          {step === 'media' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Fotos / vídeo (mínimo 2)</Label>
                <span className={cn(
                  'text-xs font-semibold',
                  files.length >= 2 ? 'text-green-600' : 'text-orange-600'
                )}>
                  {files.length} / 2 mín.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => cameraInputRef.current?.click()}
                  className="h-20 flex-col gap-1"
                >
                  <Camera className="h-5 w-5" />
                  <span className="text-xs">Cámara</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-20 flex-col gap-1"
                >
                  <ImageIcon className="h-5 w-5" />
                  <span className="text-xs">Galería</span>
                </Button>
              </div>

              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*,video/*"
                capture="environment"
                className="hidden"
                onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
              />

              {files.length > 0 && (
                <div className="grid grid-cols-3 gap-2 pt-2">
                  {files.map((f, idx) => {
                    const url = URL.createObjectURL(f);
                    const isVideo = f.type.startsWith('video/');
                    return (
                      <div key={idx} className="relative aspect-square rounded-md overflow-hidden border bg-muted">
                        {isVideo ? (
                          <video src={url} className="w-full h-full object-cover" />
                        ) : (
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        )}
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {isPrivileged && (
                <label className="flex items-start gap-2 pt-2 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={publishDirect}
                    onChange={(e) => setPublishDirect(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    Publicar directamente como <strong>Abierta</strong> (visible para el cliente sin pasar por revisión).
                  </span>
                </label>
              )}

            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t flex items-center gap-2">
          {stepIndex > 0 ? (
            <Button
              variant="outline"
              onClick={goBack}
              disabled={createIncident.isPending}
              className="h-11"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Atrás
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={() => handleClose(false)}
              disabled={createIncident.isPending}
              className="h-11"
            >
              Cancelar
            </Button>
          )}

          {step !== 'media' ? (
            <Button
              onClick={goNext}
              disabled={!canAdvance}
              className="flex-1 h-11"
            >
              Siguiente
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!canAdvance || createIncident.isPending}
              className="flex-1 h-11"
            >
              {createIncident.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando…</>
              ) : (
                <><Check className="h-4 w-4 mr-2" />Enviar incidencia</>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
