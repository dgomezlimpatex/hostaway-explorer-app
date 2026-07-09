import { useMemo, useState } from 'react';
import { Edit3, Plus, Trash2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useAssignCleanerToGroup, useRemoveCleanerFromGroup, useUpdateCleanerAssignment } from '@/hooks/usePropertyGroups';
import type { Cleaner } from '@/types/calendar';
import type { PlanningBuildingCrmProfile, PlanningBuildingCrmTeamMember } from '@/types/operationalPlanning';

interface BuildingTeamEditorProps {
  profile: PlanningBuildingCrmProfile;
  allCleaners: Cleaner[];
  isLoadingCleaners?: boolean;
  onSaved?: () => void | Promise<void>;
}

type TeamRole = PlanningBuildingCrmTeamMember['roleType'];
type DialogMode = 'add' | 'edit';

interface TeamFormData {
  cleanerId: string;
  roleType: TeamRole;
  priority: number;
  knowledgeLevel: number;
  maxTasksPerDay: number;
  maxDailyMinutesOverride: string;
  estimatedTravelTimeMinutes: number;
  notes: string;
  isActive: boolean;
}

const roleOptions: Array<{ value: TeamRole; label: string; helper: string; badgeClass: string }> = [
  { value: 'primary', label: 'Titular', helper: 'Primera opción para este edificio.', badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  { value: 'secondary', label: 'Suplente', helper: 'Entra si no llega el equipo titular.', badgeClass: 'border-blue-200 bg-blue-50 text-blue-800' },
  { value: 'backup', label: 'Backup', helper: 'Solo refuerzo o días de presión.', badgeClass: 'border-purple-200 bg-purple-50 text-purple-800' },
  { value: 'excluded', label: 'No apta', helper: 'Nunca debe entrar en propuestas.', badgeClass: 'border-red-200 bg-red-50 text-red-800' },
];

const roleLabels = Object.fromEntries(roleOptions.map((option) => [option.value, option.label])) as Record<TeamRole, string>;
const roleBadgeClasses = Object.fromEntries(roleOptions.map((option) => [option.value, option.badgeClass])) as Record<TeamRole, string>;
const roleOrder = Object.fromEntries(roleOptions.map((option, index) => [option.value, index])) as Record<TeamRole, number>;
const defaultPriorityByRole: Record<TeamRole, number> = {
  primary: 10,
  secondary: 20,
  backup: 30,
  excluded: 99,
};

const buildEmptyForm = (roleType: TeamRole = 'primary'): TeamFormData => ({
  cleanerId: '',
  roleType,
  priority: defaultPriorityByRole[roleType],
  knowledgeLevel: 3,
  maxTasksPerDay: 8,
  maxDailyMinutesOverride: '',
  estimatedTravelTimeMinutes: 15,
  notes: '',
  isActive: true,
});

const formFromMember = (member: PlanningBuildingCrmTeamMember): TeamFormData => ({
  cleanerId: member.cleanerId,
  roleType: member.roleType,
  priority: member.priority,
  knowledgeLevel: member.knowledgeLevel ?? 3,
  maxTasksPerDay: member.maxTasksPerDay,
  maxDailyMinutesOverride: member.maxDailyMinutesOverride ? String(member.maxDailyMinutesOverride) : '',
  estimatedTravelTimeMinutes: member.estimatedTravelTimeMinutes,
  notes: member.notes ?? '',
  isActive: member.roleType === 'excluded' ? true : member.isActive,
});

const parseOptionalMinutes = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const sortTeam = (team: PlanningBuildingCrmTeamMember[]) => [...team].sort((a, b) => {
  const roleDiff = roleOrder[a.roleType] - roleOrder[b.roleType];
  if (roleDiff !== 0) return roleDiff;
  const priorityDiff = a.priority - b.priority;
  if (priorityDiff !== 0) return priorityDiff;
  return a.cleanerName.localeCompare(b.cleanerName);
});

export const BuildingTeamEditor = ({ profile, allCleaners, isLoadingCleaners = false, onSaved }: BuildingTeamEditorProps) => {
  const assignCleaner = useAssignCleanerToGroup();
  const updateAssignment = useUpdateCleanerAssignment();
  const removeCleaner = useRemoveCleanerFromGroup();
  const [dialogMode, setDialogMode] = useState<DialogMode>('add');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<PlanningBuildingCrmTeamMember | null>(null);
  const [formData, setFormData] = useState<TeamFormData>(buildEmptyForm());

  const assignedCleanerIds = useMemo(() => new Set(profile.team.map((member) => member.cleanerId)), [profile.team]);
  const cleanerById = useMemo(() => new Map(allCleaners.map((cleaner) => [cleaner.id, cleaner])), [allCleaners]);
  const availableCleaners = useMemo(
    () => allCleaners
      .filter((cleaner) => cleaner.isActive)
      .filter((cleaner) => !assignedCleanerIds.has(cleaner.id))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [allCleaners, assignedCleanerIds],
  );
  const sortedTeam = useMemo(() => sortTeam(profile.team), [profile.team]);

  const activeTeamCount = profile.team.filter((member) => member.isActive && member.roleType !== 'excluded').length;
  const excludedCount = profile.team.filter((member) => member.roleType === 'excluded').length;
  const isSaving = assignCleaner.isPending || updateAssignment.isPending;

  const openAddDialog = (roleType: TeamRole = 'primary') => {
    setDialogMode('add');
    setEditingMember(null);
    setFormData(buildEmptyForm(roleType));
    setIsDialogOpen(true);
  };

  const openEditDialog = (member: PlanningBuildingCrmTeamMember) => {
    setDialogMode('edit');
    setEditingMember(member);
    setFormData(formFromMember(member));
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingMember(null);
    setFormData(buildEmptyForm());
  };

  const handleRoleChange = (roleType: TeamRole) => {
    setFormData((current) => ({
      ...current,
      roleType,
      priority: defaultPriorityByRole[roleType],
      isActive: roleType === 'excluded' ? true : current.isActive,
    }));
  };

  const handleSaved = async () => {
    closeDialog();
    await onSaved?.();
  };

  const handleSubmit = async () => {
    const maxDailyMinutesOverride = parseOptionalMinutes(formData.maxDailyMinutesOverride);
    const safeIsActive = formData.roleType === 'excluded' ? true : formData.isActive;

    if (dialogMode === 'add') {
      await assignCleaner.mutateAsync({
        propertyGroupId: profile.building.id,
        cleanerId: formData.cleanerId,
        roleType: formData.roleType,
        priority: formData.priority,
        knowledgeLevel: formData.knowledgeLevel,
        maxTasksPerDay: formData.maxTasksPerDay,
        maxDailyMinutesOverride,
        estimatedTravelTimeMinutes: formData.estimatedTravelTimeMinutes,
        notes: formData.notes.trim() || null,
        isActive: safeIsActive,
      });
      await handleSaved();
      return;
    }

    if (!editingMember?.assignmentId) return;
    await updateAssignment.mutateAsync({
      id: editingMember.assignmentId,
      groupId: profile.building.id,
      updates: {
        roleType: formData.roleType,
        priority: formData.priority,
        knowledgeLevel: formData.knowledgeLevel,
        maxTasksPerDay: formData.maxTasksPerDay,
        maxDailyMinutesOverride,
        estimatedTravelTimeMinutes: formData.estimatedTravelTimeMinutes,
        notes: formData.notes.trim() || null,
        isActive: safeIsActive,
      },
    });
    await handleSaved();
  };

  const handleRemove = async (member: PlanningBuildingCrmTeamMember) => {
    if (!member.assignmentId) return;
    const confirmed = window.confirm(`¿Quitar a ${member.cleanerName} del equipo de este edificio?`);
    if (!confirmed) return;
    await removeCleaner.mutateAsync({ assignmentId: member.assignmentId, groupId: profile.building.id });
    await onSaved?.();
  };

  return (
    <Card id="building-team-editor" className="border-[#310984]/10 bg-white shadow-sm shadow-[#310984]/5">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#310984]/65">Edición directa</p>
            <CardTitle className="mt-1 text-[#171321]">Equipo y No aptas del edificio</CardTitle>
            <p className="mt-1 text-sm leading-6 text-[#6b627a]">
              Añade o cambia titulares, suplentes, backups y No aptas desde esta ficha. Se guarda en el equipo operativo real del edificio.
            </p>
          </div>
          <Button type="button" className="bg-[#310984] text-white hover:bg-[#4c1bb0]" onClick={() => openAddDialog()} disabled={isLoadingCleaners || availableCleaners.length === 0}>
            <Plus className="mr-2 h-4 w-4" /> Añadir trabajadora
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">{activeTeamCount} aptas para propuesta</Badge>
          <Badge variant="outline" className="border-red-200 bg-red-50 text-red-800">{excludedCount} No apta{excludedCount === 1 ? '' : 's'}</Badge>
          <Badge variant="outline" className="border-[#310984]/15 bg-[#f7f4fb] text-[#310984]">{availableCleaners.length} disponibles para añadir</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {sortedTeam.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#310984]/15 bg-[#faf8ff] p-5 text-center text-sm text-[#6b627a]">
            <Users className="mx-auto mb-2 h-8 w-8 text-[#310984]/45" />
            Este edificio todavía no tiene equipo. Añade al menos una titular antes de pedir propuestas fiables.
          </div>
        ) : (
          <div className="space-y-2">
            {sortedTeam.map((member) => {
              const cleaner = cleanerById.get(member.cleanerId);
              const roleClass = roleBadgeClasses[member.roleType];
              return (
                <article key={member.assignmentId} className="rounded-2xl border border-[#310984]/10 bg-[#faf8ff] p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[#171321]">{member.cleanerName}</p>
                        <Badge variant="outline" className={roleClass}>{roleLabels[member.roleType]}</Badge>
                        {!member.isActive && member.roleType !== 'excluded' && <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">Inactiva</Badge>}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-[#6b627a]">
                        Prioridad {member.priority} · máx. {member.maxTasksPerDay} tareas/día
                        {member.maxDailyMinutesOverride ? ` · ${Math.round(member.maxDailyMinutesOverride / 60)} h/día edificio` : ''}
                        {` · viaje ${member.estimatedTravelTimeMinutes} min`}
                      </p>
                      {member.roleType === 'excluded' && <p className="mt-1 text-xs font-medium text-red-700">No entra en propuestas automáticas.</p>}
                      {member.notes && <p className="mt-2 rounded-xl bg-white/80 p-2 text-xs text-[#6b627a]">{member.notes}</p>}
                      {!cleaner?.isActive && <p className="mt-2 text-xs text-amber-700">Aviso: esta trabajadora no figura activa en personal.</p>}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" className="border-[#310984]/15 bg-white" onClick={() => openEditDialog(member)}>
                        <Edit3 className="mr-1.5 h-3.5 w-3.5" /> Editar
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="border-red-200 bg-white text-red-700 hover:bg-red-50" onClick={() => handleRemove(member)} disabled={removeCleaner.isPending}>
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Quitar
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={(open) => (open ? setIsDialogOpen(true) : closeDialog())}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{dialogMode === 'add' ? 'Añadir trabajadora al edificio' : `Editar ${editingMember?.cleanerName || 'trabajadora'}`}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Trabajadora</Label>
              {dialogMode === 'add' ? (
                <Select value={formData.cleanerId} onValueChange={(cleanerId) => setFormData((current) => ({ ...current, cleanerId }))}>
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingCleaners ? 'Cargando trabajadoras…' : 'Selecciona trabajadora'} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCleaners.length === 0 ? (
                      <SelectItem value="none" disabled>No hay trabajadoras disponibles para añadir</SelectItem>
                    ) : availableCleaners.map((cleaner) => (
                      <SelectItem key={cleaner.id} value={cleaner.id}>{cleaner.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={editingMember?.cleanerName || ''} disabled />
              )}
            </div>

            <div className="space-y-2">
              <Label>Rol operativo</Label>
              <Select value={formData.roleType} onValueChange={(value) => handleRoleChange(value as TeamRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label} — {option.helper}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Input
                type="number"
                min={1}
                max={999}
                value={formData.priority}
                onChange={(event) => setFormData((current) => ({ ...current, priority: Number.parseInt(event.target.value, 10) || defaultPriorityByRole[current.roleType] }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Nivel de conocimiento</Label>
              <Select value={String(formData.knowledgeLevel)} onValueChange={(value) => setFormData((current) => ({ ...current, knowledgeLevel: Number.parseInt(value, 10) || 3 }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 — apenas conoce el edificio</SelectItem>
                  <SelectItem value="2">2 — conoce algo</SelectItem>
                  <SelectItem value="3">3 — normal</SelectItem>
                  <SelectItem value="4">4 — muy fiable</SelectItem>
                  <SelectItem value="5">5 — referencia del edificio</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Máx. tareas/día</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={formData.maxTasksPerDay}
                onChange={(event) => setFormData((current) => ({ ...current, maxTasksPerDay: Number.parseInt(event.target.value, 10) || 8 }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Capacidad diaria específica del edificio (min)</Label>
              <Input
                type="number"
                min={30}
                max={720}
                placeholder="Vacío = capacidad general"
                value={formData.maxDailyMinutesOverride}
                onChange={(event) => setFormData((current) => ({ ...current, maxDailyMinutesOverride: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Tiempo de viaje entre propiedades (min)</Label>
              <Input
                type="number"
                min={0}
                max={120}
                value={formData.estimatedTravelTimeMinutes}
                onChange={(event) => setFormData((current) => ({ ...current, estimatedTravelTimeMinutes: Number.parseInt(event.target.value, 10) || 0 }))}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Notas internas</Label>
              <Textarea
                value={formData.notes}
                placeholder="Ej.: buena para salidas rápidas, no enviar a este portal, necesita llaves específicas…"
                onChange={(event) => setFormData((current) => ({ ...current, notes: event.target.value }))}
              />
            </div>

            {formData.roleType !== 'excluded' ? (
              <div className="flex items-center justify-between rounded-2xl border border-[#310984]/10 bg-[#faf8ff] p-3 md:col-span-2">
                <div>
                  <Label>Activa para este edificio</Label>
                  <p className="text-xs text-[#6b627a]">Si está inactiva, queda documentada pero no debería alimentar propuestas.</p>
                </div>
                <Switch checked={formData.isActive} onCheckedChange={(isActive) => setFormData((current) => ({ ...current, isActive }))} />
              </div>
            ) : (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 md:col-span-2">
                Esta trabajadora quedará marcada como <strong>No apta</strong> y no entra en propuestas automáticas para este edificio.
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button type="button" className="bg-[#310984] text-white hover:bg-[#4c1bb0]" onClick={handleSubmit} disabled={isSaving || (dialogMode === 'add' && !formData.cleanerId)}>
              {isSaving ? 'Guardando…' : dialogMode === 'add' ? 'Añadir al edificio' : 'Guardar cambios'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
