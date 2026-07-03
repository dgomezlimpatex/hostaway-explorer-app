import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { BriefcaseBusiness, CalendarX2, CheckCircle2, Clock, Mail, Phone, Save, User, X } from 'lucide-react';
import { Cleaner } from '@/types/calendar';
import { CreateCleanerData } from '@/services/cleanerStorage';
import { useUpdateCleaner } from '@/hooks/useCleaners';
import { useCleanerContracts } from '@/hooks/useWorkerContracts';
import { TaskTimeBreakdown } from './TaskTimeBreakdown';
import { ContractManagement } from './ContractManagement';
import { AbsencesTab } from './absences/AbsencesTab';
import { cn } from '@/lib/utils';

interface WorkerDetailModalProps {
  worker: Cleaner | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type WorkerFormData = Pick<
  CreateCleanerData,
  | 'name'
  | 'email'
  | 'telefono'
  | 'avatar'
  | 'isActive'
  | 'emergencyContactName'
  | 'emergencyContactPhone'
  | 'contractHoursPerWeek'
  | 'hourlyRate'
  | 'contractType'
>;

const initialsFor = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();

const contractTypeLabel = (type?: string) => {
  switch (type) {
    case 'full-time':
      return 'Tiempo completo';
    case 'part-time':
      return 'Tiempo parcial';
    case 'temporary':
      return 'Temporal';
    case 'freelance':
      return 'Autónomo';
    default:
      return type || 'Sin contrato';
  }
};

const getInitialFormData = (worker: Cleaner): WorkerFormData => ({
  name: worker.name,
  email: worker.email || '',
  telefono: worker.telefono || '',
  avatar: worker.avatar || '',
  isActive: worker.isActive,
  emergencyContactName: worker.emergencyContactName || '',
  emergencyContactPhone: worker.emergencyContactPhone || '',
  contractHoursPerWeek: worker.contractHoursPerWeek || 0,
  hourlyRate: worker.hourlyRate || 0,
  contractType: worker.contractType || 'part-time',
});

export const WorkerDetailModal = ({ worker, open, onOpenChange }: WorkerDetailModalProps) => {
  const [activeTab, setActiveTab] = useState('profile');
  const { data: contracts = [] } = useCleanerContracts(worker?.id || '');
  const activeContract = contracts.find((contract) => contract.isActive);

  useEffect(() => {
    if (open) setActiveTab('profile');
  }, [open, worker?.id]);

  const displayHours = activeContract?.contractHoursPerWeek || worker?.contractHoursPerWeek || 0;
  const displayRate = activeContract?.hourlyRate || worker?.hourlyRate;
  const displayContractType = activeContract?.contractType || worker?.contractType;

  if (!worker) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[94vh] w-[calc(100vw-1rem)] max-w-6xl flex-col overflow-hidden rounded-2xl p-0 sm:w-full">
        <DialogHeader className="border-b bg-gradient-to-br from-slate-950 via-slate-900 to-[#310984] p-4 text-white sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="h-14 w-14 shrink-0 border border-white/20 bg-white/10">
                <AvatarImage src={worker.avatar || undefined} />
                <AvatarFallback className="bg-white text-base font-black text-[#310984]">
                  {initialsFor(worker.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <DialogTitle className="truncate text-xl font-black sm:text-2xl">{worker.name}</DialogTitle>
                <DialogDescription className="mt-1 flex flex-wrap items-center gap-2 text-slate-200">
                  <span>{worker.category || 'Trabajadora'}</span>
                  {worker.externalId && <Badge className="border-0 bg-emerald-400 text-slate-950">REGISTRO</Badge>}
                  <Badge className={cn('border-0', worker.isActive ? 'bg-white text-slate-950' : 'bg-slate-700 text-white')}>
                    {worker.isActive ? 'Activa' : 'Inactiva'}
                  </Badge>
                </DialogDescription>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
              <MetricPill label="Contrato" value={`${displayHours || 0} h`} />
              <MetricPill label="Tarifa" value={displayRate ? `${displayRate} €` : 'N/D'} />
              <MetricPill label="Tipo" value={contractTypeLabel(displayContractType)} />
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-3 sm:p-5">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid h-auto grid-cols-2 rounded-2xl bg-white p-1 shadow-sm sm:grid-cols-4">
              <TabsTrigger value="profile" className="rounded-xl py-2.5">
                Ficha
              </TabsTrigger>
              <TabsTrigger value="tasks" className="rounded-xl py-2.5">
                Tareas
              </TabsTrigger>
              <TabsTrigger value="absences" className="rounded-xl py-2.5">
                Ausencias
              </TabsTrigger>
              <TabsTrigger value="contracts" className="rounded-xl py-2.5">
                Contratos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="mt-0">
              <WorkerProfilePanel worker={worker} />
            </TabsContent>

            <TabsContent value="tasks" className="mt-0">
              <SectionShell title="Tareas y horas" description="Revisa el trabajo asignado y el tiempo registrado.">
                <TaskTimeBreakdown workerId={worker.id} workerName={worker.name} />
              </SectionShell>
            </TabsContent>

            <TabsContent value="absences" className="mt-0">
              <SectionShell title="Ausencias y cobertura" description="Crea bajas, días libres y limpiezas de mantenimiento sin salir de la ficha.">
                <AbsencesTab cleanerId={worker.id} cleanerName={worker.name} />
              </SectionShell>
            </TabsContent>

            <TabsContent value="contracts" className="mt-0">
              <SectionShell title="Contratos" description="Gestiona contratos vigentes, vencidos y borradores.">
                <ContractManagement cleanerId={worker.id} cleanerName={worker.name} isManager />
              </SectionShell>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const MetricPill = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-white/10 bg-white/10 p-3">
    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">{label}</p>
    <p className="mt-1 truncate text-sm font-black text-white sm:text-base">{value}</p>
  </div>
);

const SectionShell = ({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
    <div>
      <h3 className="text-lg font-black text-slate-950">{title}</h3>
      <p className="text-sm text-slate-500">{description}</p>
    </div>
    {children}
  </div>
);

const WorkerProfilePanel = ({ worker }: { worker: Cleaner }) => {
  const [formData, setFormData] = useState<WorkerFormData>(() => getInitialFormData(worker));
  const updateCleaner = useUpdateCleaner();
  const isLinked = !!worker.externalId;

  useEffect(() => {
    setFormData(getInitialFormData(worker));
  }, [worker]);

  const hasChanges = useMemo(() => {
    const initial = getInitialFormData(worker);
    return JSON.stringify(initial) !== JSON.stringify(formData);
  }, [formData, worker]);

  const updateField = (field: keyof WorkerFormData, value: string | number | boolean) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => setFormData(getInitialFormData(worker));

  const saveChanges = () => {
    if (!formData.name?.trim()) return;

    updateCleaner.mutate(
      {
        id: worker.id,
        updates: {
          ...formData,
          name: formData.name.trim(),
          email: formData.email?.trim(),
          telefono: formData.telefono?.trim(),
          avatar: formData.avatar?.trim(),
          emergencyContactName: formData.emergencyContactName?.trim(),
          emergencyContactPhone: formData.emergencyContactPhone?.trim(),
        },
      },
      {
        onSuccess: () => {
          // React Query refreshes the worker list. Keep the local form aligned meanwhile.
          setFormData((current) => ({ ...current, name: current.name.trim() }));
        },
      },
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-5 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-950">Datos editables</h3>
              <p className="text-sm text-slate-500">Nombre, contacto, acceso y datos rápidos de contrato.</p>
            </div>
            <div className="flex gap-2">
              {hasChanges && (
                <Button type="button" variant="outline" onClick={resetForm} disabled={updateCleaner.isPending}>
                  <X className="mr-2 h-4 w-4" />
                  Deshacer
                </Button>
              )}
              <Button onClick={saveChanges} disabled={!hasChanges || updateCleaner.isPending || !formData.name?.trim()}>
                <Save className="mr-2 h-4 w-4" />
                {updateCleaner.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre completo" locked={isLinked} hint={isLinked ? 'Sincronizado desde REGISTRO' : undefined}>
              <Input
                value={formData.name || ''}
                onChange={(event) => updateField('name', event.target.value)}
                disabled={isLinked}
                className="h-11"
              />
            </Field>

            <Field label="Email">
              <Input
                type="email"
                value={formData.email || ''}
                onChange={(event) => updateField('email', event.target.value)}
                placeholder="correo@ejemplo.com"
                className="h-11"
              />
            </Field>

            <Field label="Teléfono">
              <Input
                value={formData.telefono || ''}
                onChange={(event) => updateField('telefono', event.target.value)}
                placeholder="Teléfono"
                className="h-11"
              />
            </Field>

            <Field label="Avatar URL">
              <Input
                value={formData.avatar || ''}
                onChange={(event) => updateField('avatar', event.target.value)}
                placeholder="https://..."
                className="h-11"
              />
            </Field>

            <Field label="Horas semanales">
              <Input
                type="number"
                min="0"
                max="80"
                value={formData.contractHoursPerWeek || 0}
                onChange={(event) => updateField('contractHoursPerWeek', Number(event.target.value) || 0)}
                className="h-11"
              />
            </Field>

            <Field label="Tarifa por hora">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.hourlyRate || 0}
                onChange={(event) => updateField('hourlyRate', Number(event.target.value) || 0)}
                className="h-11"
              />
            </Field>

            <Field label="Contacto de emergencia">
              <Input
                value={formData.emergencyContactName || ''}
                onChange={(event) => updateField('emergencyContactName', event.target.value)}
                placeholder="Nombre"
                className="h-11"
              />
            </Field>

            <Field label="Teléfono de emergencia">
              <Input
                value={formData.emergencyContactPhone || ''}
                onChange={(event) => updateField('emergencyContactPhone', event.target.value)}
                placeholder="Teléfono"
                className="h-11"
              />
            </Field>
          </div>

          <div className="flex items-center justify-between rounded-2xl border bg-slate-50 p-4">
            <div>
              <Label className="text-sm font-black text-slate-950">Trabajadora activa</Label>
              <p className="text-xs text-slate-500">
                Las trabajadoras inactivas no deberían usarse para nuevas asignaciones.
              </p>
            </div>
            <Switch
              checked={!!formData.isActive}
              onCheckedChange={(checked) => updateField('isActive', checked)}
              disabled={isLinked}
            />
          </div>
        </CardContent>
      </Card>

      <aside className="space-y-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="space-y-3 p-4">
            <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">Acceso y contacto</h3>
            <InfoLine icon={Mail} label="Email" value={worker.email || 'Sin email'} />
            <InfoLine icon={Phone} label="Teléfono" value={worker.telefono || 'Sin teléfono'} />
            <InfoLine icon={CheckCircle2} label="Acceso" value={worker.user_id ? 'Usuario vinculado' : 'Sin usuario vinculado'} />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="space-y-3 p-4">
            <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">REGISTRO</h3>
            <Badge className={isLinked ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>
              {isLinked ? 'Vinculada' : 'Solo local'}
            </Badge>
            <div className="grid gap-2 text-sm">
              <DataRow label="DNI" value={worker.dni} />
              <DataRow label="PIN" value={worker.pin} />
              <DataRow label="Categoría" value={worker.category} />
              <DataRow label="Delegación" value={worker.delegationName} />
              <DataRow label="Oficina" value={worker.officeName} />
              <DataRow label="ID externo" value={worker.externalId} mono />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-[#f4f0ff] shadow-sm">
          <CardContent className="space-y-2 p-4">
            <h3 className="text-sm font-black text-[#310984]">Acciones frecuentes</h3>
            <QuickHint icon={CalendarX2} text="Ausencias: entra en la pestaña Ausencias y pulsa Nueva ausencia." />
            <QuickHint icon={BriefcaseBusiness} text="Contratos: entra en Contratos y pulsa Nuevo contrato." />
          </CardContent>
        </Card>
      </aside>
    </div>
  );
};

const Field = ({
  label,
  hint,
  locked,
  children,
}: {
  label: string;
  hint?: string;
  locked?: boolean;
  children: React.ReactNode;
}) => (
  <div className="space-y-2">
    <Label className="flex items-center gap-2 text-sm font-bold text-slate-800">
      {label}
      {locked && <Badge variant="secondary" className="text-[10px]">REGISTRO</Badge>}
    </Label>
    {children}
    {hint && <p className="text-xs text-slate-500">{hint}</p>}
  </div>
);

const InfoLine = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) => (
  <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#310984]" />
    <div className="min-w-0">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="truncate text-sm font-semibold text-slate-950">{value}</p>
    </div>
  </div>
);

const DataRow = ({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) => (
  <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
    <span className="text-slate-500">{label}</span>
    <span className={cn('truncate text-right font-semibold text-slate-950', mono && 'font-mono text-xs')}>
      {value || '—'}
    </span>
  </div>
);

const QuickHint = ({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
}) => (
  <div className="flex gap-2 text-sm text-[#310984]">
    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
    <span>{text}</span>
  </div>
);
