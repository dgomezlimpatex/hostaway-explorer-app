import React, { useState, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Camera, Check, Image as ImageIcon, Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIncidentCategories, useCreateIncident } from '@/hooks/useCleaningIncidents';

interface ReportIncidentDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  taskId: string;
  propertyName?: string;
}

export const ReportIncidentDialog: React.FC<ReportIncidentDialogProps> = ({
  open,
  onOpenChange,
  taskId,
  propertyName,
}) => {
  const { data: categories = [], isLoading: loadingCats } = useIncidentCategories();
  const createIncident = useCreateIncident();

  const [categoryId, setCategoryId] = useState<string>('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setCategoryId('');
    setLocation('');
    setDescription('');
    setFiles([]);
  };

  const handleClose = (v: boolean) => {
    if (!v && !createIncident.isPending) reset();
    onOpenChange(v);
  };

  const canSubmit = useMemo(() => {
    return !!categoryId && description.trim().length >= 5 && files.length >= 2;
  }, [categoryId, description, files]);

  const handleFiles = (selected: FileList | null) => {
    if (!selected) return;
    const arr = Array.from(selected).filter((f) =>
      f.type.startsWith('image/') || f.type.startsWith('video/')
    );
    setFiles((prev) => [...prev, ...arr].slice(0, 10));
  };

  const removeFile = (idx: number) => setFiles((p) => p.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      await createIncident.mutateAsync({
        taskId,
        categoryId,
        description: description.trim(),
        location: location.trim() || undefined,
        files,
        createAsOpen: false,
      });
      handleClose(false);
    } catch {
      /* toast handled in hook */
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl gap-0 p-0 max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base">Reportar incidencia</DialogTitle>
              <DialogDescription className="text-xs truncate">
                {propertyName || 'Tarea en curso'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div className="space-y-2">
            <Label className="text-sm">Categoría</Label>
            <Select value={categoryId} onValueChange={setCategoryId} disabled={loadingCats}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder={loadingCats ? 'Cargando...' : 'Selecciona una categoría'} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Ubicación dentro de la propiedad</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ej: baño principal, cocina, salón..."
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              Opcional, pero ayuda mucho si el problema está en una zona concreta.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Descripción</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe qué ocurre y qué debe revisar Limpatex..."
              className="min-h-[110px]"
            />
            <p className={cn(
              'text-xs',
              description.trim().length >= 5 ? 'text-green-600' : 'text-muted-foreground'
            )}>
              Mínimo 5 caracteres. Sé clara para que se pueda revisar rápido.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm">Fotos / vídeo</Label>
              <span className={cn(
                'text-xs font-semibold',
                files.length >= 2 ? 'text-green-600' : 'text-orange-600'
              )}>
                {files.length} / 2 mínimo
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => cameraInputRef.current?.click()}
                className="h-16 flex-col gap-1"
              >
                <Camera className="h-5 w-5" />
                <span className="text-xs">Cámara</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="h-16 flex-col gap-1"
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
              <div className="grid grid-cols-4 gap-2 pt-1 sm:grid-cols-5">
                {files.map((f, idx) => {
                  const url = URL.createObjectURL(f);
                  const isVideo = f.type.startsWith('video/');
                  return (
                    <div key={`${f.name}-${idx}`} className="relative aspect-square rounded-md overflow-hidden border bg-muted">
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
          </div>

        </div>

        <div className="px-5 py-3 border-t flex items-center gap-2 bg-white">
          <Button
            variant="ghost"
            onClick={() => handleClose(false)}
            disabled={createIncident.isPending}
            className="h-11"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || createIncident.isPending}
            className="flex-1 h-11"
          >
            {createIncident.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</>
            ) : (
              <><Check className="h-4 w-4 mr-2" />Enviar incidencia</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
