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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  BriefcaseBusiness,
  CalendarX2,
  CheckCircle2,
  Mail,
  Phone,
  Save,
  UserRoundCheck,
  X,
} from 'lucide-react';
import { Cleaner } from '@/types/calendar';
import { CreateCleanerData } from '@/services/cleanerStorage';
import { useUpdateCleaner } from '@/hooks/useCleaners';
import { useCleanerContracts } from '@/hooks/useWorkerContracts';
import { TaskTimeBreakdown } from './TaskTimeBreakdown';
import { ContractManagement } from './ContractManagement';
import { AbsencesTab } from './absences/AbsencesTab';
import { DeactivateWorkerDialog } from './DeactivateWorkerDialog';
import { cn } from '@/lib/utils';

interface WorkerDetailModalProps {
  worker: Cleaner | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface WorkerDetailPanelProps {
  worker: Cleaner;
  className?: string;
  inDialog?: boolean;
}

type WorkerFormData = Pick<
  CreateCleanerData,
  | 'name'
  | 'email'
  | 'telefono'
  | 'isActive'
  | 'category'
  | 'startDate'
>;

const WORKER_CATEGORY_OPTIONS = [
  'Operario de limpieza',
  'Supervisor',
  'Administrador',
] as const;

const normalizeWorkerCategory = (category?: string | null) => {
  const normalized = (category || '').trim().toLowerCase();
  if (['admin', 'administrador', 'administradora'].includes(normalized)) return 'Administrador';
  if (['supervisor', 'supervisora', 'encargado', 'encargada'].includes(normalized)) return 'Supervisor';
  return 'Operario de limpieza';
};

const initialsFor = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();


const getInitialFormData = (worker: Cleaner): WorkerFormData => ({
  name: worker.name,
  email: worker.email || '',
  telefono: worker.telefono || '',
  isActive: worker.isActive,
  category: normalizeWorkerCategory(worker.category),
  startDate: worker.startDate || '',
});

export const WorkerDetailModal = ({ worker, open, onOpenChange }: WorkerDetailModalProps) => {
  if (!worker) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[94vh] w-[calc(100vw-1rem)] max-w-6xl flex-col overflow-hidden rounded-2xl p-0 sm:w-full">
        <WorkerDetailPanel worker={worker} inDialog />
      </DialogContent>
    </Dialog>
  );
};

export const WorkerDetailPanel = ({ worker, className, inDialog = false }: WorkerDetailPanelProps) => {
  const [activeTab, setActiveTab] = useState('profile');
  const { data: contracts = [] } = useCleanerContracts(worker.id);
  const activeContract = contracts.find((contract) => contract.isActive);

  useEffect(() => {
    setActiveTab('profile');
  }, [worker.id]);

  const displayHours = activeContract?.contractHoursPerWeek || worker.contractHoursPerWeek || 0;

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-white shadow-sm', className)}>
      <WorkerDetailHeaderContainer inDialog={inDialog}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="h-14 w-14 shrink-0 border border-white/20 bg-white/10">
              <AvatarImage src={worker.avatar || undefined} />
              <AvatarFallback className="bg-white text-base font-black text-[#310984]">
                {initialsFor(worker.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              {inDialog ? (
                <DialogTitle className="truncate text-xl font-black sm:text-2xl">{worker.name}</DialogTitle>
              ) : (
                <h2 className="truncate text-xl font-black sm:text-2xl">{worker.name}</h2>
              )}
              <WorkerDetailSubtitle inDialog={inDialog}>
                <span>{normalizeWorkerCategory(worker.category)}</span>
                {worker.externalId && <Badge className="border-0 bg-emerald-400 text-slate-950">REGISTRO</Badge>}
                <Badge className={cn('border-0', worker.isActive ? 'bg-white text-slate-950' : 'bg-slate-700 text-white')}>
                  {worker.isActive ? 'Activa' : 'Inactiva'}
                </Badge>
              </WorkerDetailSubtitle>
            </div>
          </div>

          <div className="grid gap-2 xl:min-w-[160px]">
            <MetricPill label="Contrato" value={`${displayHours || 0} h`} />
          </div>
        </div>
      </WorkerDetailHeaderContainer>

      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-3 sm:p-5">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="sticky top-0 z-10 grid h-auto grid-cols-2 rounded-2xl bg-white p-1 shadow-sm sm:grid-cols-4">
            <TabsTrigger value="profile" className="rounded-xl py-2.5">Ficha</TabsTrigger>
            <TabsTrigger value="tasks" className="rounded-xl py-2.5">Tareas</TabsTrigger>
            <TabsTrigger value="absences" className="rounded-xl py-2.5">Ausencias</TabsTrigger>
            <TabsTrigger value="contracts" className="rounded-xl py-2.5">Contratos</TabsTrigger>
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
    </div>
  );
};

const MetricPill = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-white/10 bg-white/10 p-3">
    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">{label}</p>
    <p className="mt-1 truncate text-sm font-black text-white sm:text-base">{value}</p>
  </div>
);

const WorkerDetailHeaderContainer = ({
  inDialog,
  children,
}: {
  inDialog: boolean;
  children: React.ReactNode;
}) => {
  const className = 'border-b bg-gradient-to-br from-slate-950 via-slate-900 to-[#310984] p-4 text-white sm:p-6';

  return inDialog ? (
    <DialogHeader className={className}>{children}</DialogHeader>
  ) : (
    <div className={className}>{children}</div>
  );
};

const WorkerDetailSubtitle = ({
  inDialog,
  children,
}: {
  inDialog: boolean;
  children: React.ReactNode;
}) => {
  const className = 'mt-1 flex flex-wrap items-center gap-2 text-slate-200';

  return inDialog ? (
    <DialogDescription className={className}>{children}</DialogDescription>
  ) : (
    <div className={cn(className, 'text-sm')}>{children}</div>
  );
};

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
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const updateCleaner = useUpdateCleaner();
  const isLinked = !!worker.externalId;

  useEffect(() => {
    setFormData(getInitialFormData(worker));
  }, [worker]);

  const hasChanges = useMemo(() => {
    const initial = getInitialFormData(worker);
    return JSON.stringify(initial) !== JSON.stringify(formData);
  }, [formData, worker]);

  const updateField = (field: keyof WorkerFormData, value: string | boolean) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => setFormData(getInitialFormData(worker));

  const saveChanges = () => {
    if (!formData.name?.trim()) return;

    updateCleaner.mutate(
      {
        id: worker.id,
        updates: {
          name: formData.name.trim(),
          email: formData.email?.trim(),
          telefono: formData.telefono?.trim(),
          category: formData.category?.trim(),
          ...(!worker.isActive && formData.isActive ? { isActive: true } : {}),
          startDate: formData.startDate || undefined,
        },
      },
      {
        onSuccess: () => {
          setFormData((current) => ({ ...current, name: current.name.trim() }));
        },
      },
    );
  };

  return (
    <>
      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-5 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-950">Datos editables</h3>
              <p className="text-sm text-slate-500">Datos básicos de identificación y acceso. Contratos y ausencias se gestionan en sus pestañas.</p>
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
                {updateCleaner.isPending ? 'Guardando...' : 'Guardar ficha'}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre completo" hint={isLinked ? 'Viene de REGISTRO, pero puedes ajustarlo aquí si lo necesitas.' : undefined}>
              <Input value={formData.name || ''} onChange={(event) => updateField('name', event.target.value)} className="h-11" />
            </Field>

            <Field label="Email">
              <Input type="email" value={formData.email || ''} onChange={(event) => updateField('email', event.target.value)} placeholder="correo@ejemplo.com" className="h-11" />
            </Field>

            <Field label="Teléfono">
              <Input value={formData.telefono || ''} onChange={(event) => updateField('telefono', event.target.value)} placeholder="Teléfono" className="h-11" />
            </Field>

            <Field label="Categoría / puesto">
              <Select value={formData.category || 'Operario de limpieza'} onValueChange={(value) => updateField('category', value)}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WORKER_CATEGORY_OPTIONS.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Fecha de inicio">
              <Input type="date" value={formData.startDate || ''} onChange={(event) => updateField('startDate', event.target.value)} className="h-11" />
            </Field>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-sm font-black text-slate-950">Trabajadora activa</Label>
                <p className="text-xs text-slate-500">Las trabajadoras inactivas no deberían usarse para nuevas asignaciones.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (worker.isActive) {
                    setDeactivateOpen(true);
                    return;
                  }
                  updateField('isActive', !formData.isActive);
                }}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-black transition-colors',
                  formData.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700',
                )}
              >
                {formData.isActive ? 'Activa' : 'Inactiva'}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <aside className="space-y-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="space-y-3 p-4">
            <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">Acceso</h3>
            <InfoLine icon={Mail} label="Email" value={worker.email || 'Sin email'} />
            <InfoLine icon={Phone} label="Teléfono" value={worker.telefono || 'Sin teléfono'} />
            <InfoLine icon={CheckCircle2} label="Acceso" value={worker.user_id ? 'Usuario vinculado' : 'Sin usuario vinculado'} />
            <InfoLine icon={UserRoundCheck} label="Estado" value={worker.isActive ? 'Activa para asignar' : 'Inactiva'} />
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
              <DataRow label="Categoría" value={normalizeWorkerCategory(worker.category)} />
              <DataRow label="Delegación" value={worker.delegationName} />
              <DataRow label="Oficina" value={worker.officeName} />
              <DataRow label="ID externo" value={worker.externalId} mono />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-[#f4f0ff] shadow-sm">
          <CardContent className="space-y-2 p-4">
            <h3 className="text-sm font-black text-[#310984]">Acciones frecuentes</h3>
            <QuickHint icon={CalendarX2} text="Ausencias: abre la pestaña Ausencias y pulsa Nueva ausencia." />
            <QuickHint icon={BriefcaseBusiness} text="Contratos: abre Contratos y pulsa Nuevo contrato." />
          </CardContent>
        </Card>
      </aside>
      </div>
      <DeactivateWorkerDialog
        worker={worker}
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        onDone={() => {
          setFormData((current) => ({ ...current, isActive: false }));
        }}
      />
    </>
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
      {value || '-'}
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
