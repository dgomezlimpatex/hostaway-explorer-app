import { useEffect, useMemo, useState } from 'react';
import { Building2, Clock3, Loader2, Pencil, Save, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { propertyGroupStorage } from '@/services/storage/propertyGroupStorage';
import type { PlanningBuildingCrmProfile } from '@/types/operationalPlanning';

interface BuildingDataEditorProps {
  profile: PlanningBuildingCrmProfile;
  onSaved: () => void;
}

type BuildingFormData = {
  name: string;
  internalCode: string;
  displayName: string;
  zone: string;
  clientName: string;
  checkOutTime: string;
  checkInTime: string;
  planningNotes: string;
};

const normalizeTime = (value?: string | null) => (value || '').slice(0, 5);

const buildFormData = (profile: PlanningBuildingCrmProfile): BuildingFormData => ({
  name: profile.building.name || '',
  internalCode: profile.building.internalCode || '',
  displayName: profile.building.displayName || '',
  zone: profile.building.zone || '',
  clientName: profile.building.clientName || '',
  checkOutTime: normalizeTime(profile.building.checkOutTime) || '11:00',
  checkInTime: normalizeTime(profile.building.checkInTime) || '16:00',
  planningNotes: profile.building.planningNotes || '',
});

const optionalValue = (value: string) => value.trim();

export const BuildingDataEditor = ({ profile, onSaved }: BuildingDataEditorProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState<BuildingFormData>(() => buildFormData(profile));

  useEffect(() => {
    if (!isEditing) setFormData(buildFormData(profile));
  }, [isEditing, profile]);

  const excludedCount = useMemo(
    () => profile.team.filter((member) => member.roleType === 'excluded').length,
    [profile.team],
  );
  const activeTeamCount = profile.team.length - excludedCount;
  const canDelete = profile.building.propertyCount === 0 && activeTeamCount === 0 && excludedCount === 0;

  const updateField = (field: keyof BuildingFormData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async () => {
    const name = formData.name.trim();
    const internalCode = formData.internalCode.trim();

    if (!name) {
      toast({ title: 'Falta el nombre', description: 'El nombre del edificio es obligatorio.', variant: 'destructive' });
      return;
    }
    if (!internalCode) {
      toast({ title: 'Falta el código interno', description: 'Indica un código operativo para identificar el edificio.', variant: 'destructive' });
      return;
    }
    if (!formData.checkOutTime || !formData.checkInTime) {
      toast({ title: 'Faltan los horarios', description: 'Indica las horas de check-out y check-in del edificio.', variant: 'destructive' });
      return;
    }
    if (formData.checkInTime <= formData.checkOutTime) {
      toast({ title: 'Horario no válido', description: 'El check-in debe ser posterior al check-out.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      await propertyGroupStorage.updatePropertyGroup(profile.building.id, {
        name,
        internalCode,
        displayName: optionalValue(formData.displayName),
        zone: optionalValue(formData.zone),
        clientName: optionalValue(formData.clientName),
        checkOutTime: formData.checkOutTime,
        checkInTime: formData.checkInTime,
        planningNotes: optionalValue(formData.planningNotes),
      });
      await queryClient.invalidateQueries({ queryKey: ['cleaning-planning-building-data'] });
      setIsEditing(false);
      onSaved();
      toast({
        title: 'Edificio actualizado',
        description: 'Los datos y horarios comunes se han guardado correctamente.',
      });
    } catch (error) {
      toast({
        title: 'No se pudo actualizar el edificio',
        description: error instanceof Error ? error.message : 'Revisa los datos e inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canDelete) return;
    setIsDeleting(true);
    try {
      await propertyGroupStorage.deleteEmptyPropertyGroup(profile.building.id);
      toast({ title: 'Edificio eliminado', description: 'El edificio vacío se eliminó correctamente.' });
      navigate('/planning/buildings', { replace: true });
    } catch (error) {
      toast({
        title: 'No se pudo eliminar el edificio',
        description: error instanceof Error ? error.message : 'Actualiza la ficha y revisa sus relaciones.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card id="building-data-editor" className="border-[#310984]/12 bg-white shadow-sm">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg text-[#171321]">
            <Building2 className="h-5 w-5 text-[#310984]" />
            Datos del edificio
          </CardTitle>
          <p className="mt-1 text-sm text-[#6b627a]">Edita la identidad y la ventana horaria común de todo el edificio.</p>
        </div>
        {!isEditing && (
          <Button type="button" variant="outline" className="border-[#310984]/15 text-[#310984]" onClick={() => setIsEditing(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Editar datos
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="building-name">Nombre *</Label>
            <Input id="building-name" value={formData.name} onChange={(event) => updateField('name', event.target.value)} disabled={!isEditing || isSaving} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="building-code">Código interno *</Label>
            <Input id="building-code" value={formData.internalCode} onChange={(event) => updateField('internalCode', event.target.value)} disabled={!isEditing || isSaving} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="building-display-name">Nombre visible</Label>
            <Input id="building-display-name" value={formData.displayName} onChange={(event) => updateField('displayName', event.target.value)} disabled={!isEditing || isSaving} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="building-zone">Zona</Label>
            <Input id="building-zone" value={formData.zone} onChange={(event) => updateField('zone', event.target.value)} disabled={!isEditing || isSaving} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="building-client">Cliente</Label>
            <Input id="building-client" value={formData.clientName} onChange={(event) => updateField('clientName', event.target.value)} disabled={!isEditing || isSaving} />
          </div>
        </div>

        <div className="rounded-2xl border border-[#310984]/10 bg-[#faf8ff] p-4">
          <div className="mb-3 flex items-start gap-2">
            <Clock3 className="mt-0.5 h-4 w-4 text-[#310984]" />
            <div>
              <p className="text-sm font-semibold text-[#171321]">Horario común del edificio</p>
              <p className="text-xs leading-5 text-[#6b627a]">Esta ventana se usará como referencia para planificar todas sus propiedades.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="building-checkout">Check-out *</Label>
              <Input id="building-checkout" type="time" value={formData.checkOutTime} onChange={(event) => updateField('checkOutTime', event.target.value)} disabled={!isEditing || isSaving} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="building-checkin">Check-in *</Label>
              <Input id="building-checkin" type="time" value={formData.checkInTime} onChange={(event) => updateField('checkInTime', event.target.value)} disabled={!isEditing || isSaving} />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="building-notes">Notas de planificación</Label>
          <Textarea id="building-notes" className="min-h-24" value={formData.planningNotes} onChange={(event) => updateField('planningNotes', event.target.value)} disabled={!isEditing || isSaving} />
        </div>

        {isEditing && (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => { setFormData(buildFormData(profile)); setIsEditing(false); }} disabled={isSaving}>Cancelar</Button>
            <Button type="button" className="bg-[#310984] text-white hover:bg-[#4c1bb0]" onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSaving ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>
        )}

        <div className="border-t border-red-100 pt-5">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-red-900">Eliminar edificio</p>
                <p className="mt-1 text-sm leading-5 text-red-800/80">
                  {canDelete
                    ? 'Está vacío: no tiene propiedades, equipo ni personas marcadas como No aptas.'
                    : `Antes debes desvincular ${profile.building.propertyCount} propiedades, ${activeTeamCount} personas del equipo y ${excludedCount} No aptas.`}
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" className="shrink-0 border-red-300 bg-white text-red-700 hover:bg-red-100 hover:text-red-800">
                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar edificio
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{canDelete ? '¿Eliminar este edificio?' : 'Este edificio todavía no se puede eliminar'}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {canDelete
                        ? 'Se eliminará permanentemente. Esta acción no se puede deshacer.'
                        : 'Para evitar borrar configuración operativa por accidente, primero desvincula todas las propiedades, personas del equipo y No aptas desde esta ficha.'}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{canDelete ? 'Cancelar' : 'Entendido'}</AlertDialogCancel>
                    {canDelete && (
                      <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={() => void handleDelete()} disabled={isDeleting}>
                        {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Sí, eliminar edificio
                      </AlertDialogAction>
                    )}
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
