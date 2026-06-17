import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Link as LinkIcon,
  RefreshCw,
  Search,
  UserPlus,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type Decision = 'link' | 'create' | 'ignore';
type ProposalFilter = 'pending' | 'new' | 'similar' | 'exact' | 'linked' | 'selected' | 'all';

type RegistroEmployee = {
  id: string;
  name: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  dni?: string | null;
  pin?: string | null;
  category?: string | null;
  delegation_name?: string | null;
  office_name?: string | null;
  is_active?: boolean | null;
  hire_date?: string | null;
};

type Proposal = {
  registro: RegistroEmployee;
  match_type: 'already_linked' | 'exact_name' | 'fuzzy_name' | 'no_match';
  cleaner: { id: string; name: string; email?: string | null } | null;
  confidence: number;
  distance?: number;
};

type PreviewResponse = {
  ok: boolean;
  summary: {
    registro_total: number;
    already_linked: number;
    exact: number;
    fuzzy: number;
    no_match: number;
    gestion_unmatched: number;
  };
  proposals: Proposal[];
  gestion_unmatched: Array<{ id: string; name: string; email?: string | null }>;
};

type SedeOption = { id: string; nombre: string };

type SyncLog = {
  id: string;
  run_at: string;
  triggered_by: string;
  dry_run: boolean;
  fetched: number;
  linked: number;
  created: number;
  updated: number;
  deactivated: number;
  success: boolean;
};

type AccessConfirmation = {
  email: string;
  createWithoutAccess: boolean;
};

type InvitationDetail = {
  external_id?: string;
  cleaner_id?: string | null;
  email: string | null;
  outcome: string;
  invitation_url?: string;
  error?: string;
};

type LinkResponse = {
  linked: number;
  created: number;
  invitations_sent?: number;
  invitation_details?: InvitationDetail[];
  errors?: Array<unknown>;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { message?: unknown }).message);
  }
  return 'No se pudo completar la operación';
};

const getDefaultDecision = (proposal: Proposal): Decision => {
  if (proposal.match_type === 'exact_name' && proposal.cleaner) return 'link';
  return 'ignore';
};

const getSearchText = (proposal: Proposal) =>
  [
    proposal.registro.name,
    proposal.registro.email,
    proposal.registro.phone,
    proposal.registro.dni,
    proposal.registro.category,
    proposal.registro.delegation_name,
    proposal.registro.office_name,
    proposal.cleaner?.name,
    proposal.cleaner?.email,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const getProposalPriority = (proposal: Proposal) => {
  switch (proposal.match_type) {
    case 'no_match':
      return 0;
    case 'fuzzy_name':
      return 1;
    case 'exact_name':
      return 2;
    case 'already_linked':
      return 3;
  }
};

const Integraciones = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [includeInactive, setIncludeInactive] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [createSedeId, setCreateSedeId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<ProposalFilter>('pending');
  const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);
  const [accessConfirmations, setAccessConfirmations] = useState<Record<string, AccessConfirmation>>({});
  const [invitationDetails, setInvitationDetails] = useState<InvitationDetail[]>([]);

  const { data: sedes = [] } = useQuery({
    queryKey: ['sedes-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sedes')
        .select('id, nombre')
        .eq('is_active', true)
        .order('nombre');
      if (error) throw error;
      return (data || []) as SedeOption[];
    },
  });

  const { data: logs = [], refetch: refetchLogs } = useQuery({
    queryKey: ['employee-sync-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_sync_log')
        .select('id, run_at, triggered_by, dry_run, fetched, linked, created, updated, deactivated, success')
        .order('run_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as SyncLog[];
    },
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-employees-from-registro', {
        body: { mode: 'preview', include_inactive: includeInactive },
      });
      if (error) throw error;
      return data as PreviewResponse;
    },
    onSuccess: (data) => {
      const defaults: Record<string, Decision> = {};
      data.proposals.forEach((proposal) => {
        defaults[proposal.registro.id] = getDefaultDecision(proposal);
      });
      setPreview(data);
      setDecisions(defaults);
      setSelectedIds(new Set());
      refetchLogs();
      toast({
        title: 'Vista previa lista',
        description: `${data.summary.registro_total} empleados encontrados en REGISTRO.`,
      });
    },
    onError: (error) => {
      toast({ title: 'Error en la vista previa', description: getErrorMessage(error), variant: 'destructive' });
    },
  });

  const proposals = useMemo(() => preview?.proposals || [], [preview]);

  const filteredProposals = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return proposals
      .filter((proposal) => {
        if (query && !getSearchText(proposal).includes(query)) return false;

        if (filter === 'selected') return selectedIds.has(proposal.registro.id);
        if (filter === 'new') return proposal.match_type === 'no_match';
        if (filter === 'similar') return proposal.match_type === 'fuzzy_name';
        if (filter === 'exact') return proposal.match_type === 'exact_name';
        if (filter === 'linked') return proposal.match_type === 'already_linked';
        if (filter === 'pending') return proposal.match_type !== 'already_linked';
        return true;
      })
      .sort((a, b) => {
        const priorityDiff = getProposalPriority(a) - getProposalPriority(b);
        if (priorityDiff !== 0) return priorityDiff;
        return a.registro.name.localeCompare(b.registro.name, 'es', { sensitivity: 'base' });
      });
  }, [filter, proposals, searchQuery, selectedIds]);

  const selectedProposals = useMemo(
    () => proposals.filter((proposal) => selectedIds.has(proposal.registro.id)),
    [proposals, selectedIds]
  );

  const selectedActionableProposals = useMemo(
    () =>
      selectedProposals.filter((proposal) => {
        const decision = decisions[proposal.registro.id] || 'ignore';
        return decision === 'create' || (decision === 'link' && proposal.cleaner);
      }),
    [decisions, selectedProposals]
  );

  const selectedSummary = useMemo(() => {
    return selectedProposals.reduce(
      (summary, proposal) => {
        const decision = decisions[proposal.registro.id] || 'ignore';
        if (decision === 'create') summary.create += 1;
        if (decision === 'link' && proposal.cleaner) summary.link += 1;
        if (decision === 'ignore') summary.ignore += 1;
        return summary;
      },
      { create: 0, link: 0, ignore: 0 }
    );
  }, [decisions, selectedProposals]);

  const actionableVisibleIds = filteredProposals
    .filter((proposal) => proposal.match_type !== 'already_linked')
    .map((proposal) => proposal.registro.id);

  const allVisibleSelected = actionableVisibleIds.length > 0 && actionableVisibleIds.every((id) => selectedIds.has(id));

  const toggleSelection = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleVisibleSelection = (checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      actionableVisibleIds.forEach((id) => {
        if (checked) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  const setDecision = (id: string, decision: Decision) => {
    setDecisions((current) => ({ ...current, [id]: decision }));
    if (decision !== 'ignore') toggleSelection(id, true);
  };

  const setAccessConfirmation = (id: string, patch: Partial<AccessConfirmation>) => {
    setAccessConfirmations((current) => ({
      ...current,
      [id]: {
        email: current[id]?.email || '',
        createWithoutAccess: current[id]?.createWithoutAccess || false,
        ...patch,
      },
    }));
  };

  const handleApplySelection = () => {
    if (!preview) {
      toast({ title: 'Carga primero la vista previa', variant: 'destructive' });
      return;
    }

    if (selectedActionableProposals.length === 0) {
      toast({
        title: 'Sin trabajadoras para aplicar',
        description: 'Selecciona al menos una trabajadora para crear o vincular.',
        variant: 'destructive',
      });
      return;
    }

    const hasNewWorkers = selectedActionableProposals.some(
      (proposal) => (decisions[proposal.registro.id] || 'ignore') === 'create'
    );
    if (hasNewWorkers && !createSedeId) {
      toast({
        title: 'Selecciona una sede',
        description: 'La sede es obligatoria para crear trabajadoras nuevas.',
        variant: 'destructive',
      });
      return;
    }

    const defaults: Record<string, AccessConfirmation> = {};
    selectedActionableProposals.forEach((proposal) => {
      const email = proposal.registro.email || proposal.cleaner?.email || '';
      defaults[proposal.registro.id] = {
        email,
        createWithoutAccess: !email,
      };
    });
    setAccessConfirmations(defaults);
    setIsAccessDialogOpen(true);
  };

  const confirmAccessAndApply = () => {
    const normalized: Record<string, AccessConfirmation> = {};

    for (const proposal of selectedActionableProposals) {
      const current = accessConfirmations[proposal.registro.id] || { email: '', createWithoutAccess: true };
      const email = current.email.trim().toLowerCase();
      if (email && !emailRegex.test(email)) {
        toast({
          title: 'Email no válido',
          description: `Revisa el email de ${proposal.registro.name || 'la trabajadora seleccionada'}.`,
          variant: 'destructive',
        });
        return;
      }
      normalized[proposal.registro.id] = {
        email,
        createWithoutAccess: current.createWithoutAccess || !email,
      };
    }

    linkMutation.mutate(normalized);
  };

  const linkMutation = useMutation({
    mutationFn: async (confirmations: Record<string, AccessConfirmation>) => {
      if (!preview) throw new Error('Primero carga la vista previa');

      const links = selectedProposals.flatMap((proposal) => {
        const decision = decisions[proposal.registro.id] || 'ignore';
        const access = confirmations[proposal.registro.id];
        const accessEmail = access?.email?.trim().toLowerCase() || null;
        const createWithoutAccess = access?.createWithoutAccess || !accessEmail;
        if (decision === 'ignore') return [];
        if (decision === 'link' && proposal.cleaner) {
          return [{
            external_id: proposal.registro.id,
            cleaner_id: proposal.cleaner.id,
            access_email: accessEmail,
            create_without_access: createWithoutAccess,
          }];
        }
        if (decision === 'create') {
          if (!createSedeId) throw new Error('Selecciona una sede para los nuevos trabajadores');
          return [{
            external_id: proposal.registro.id,
            create_new: true,
            sede_id: createSedeId,
            snapshot: proposal.registro,
            access_email: accessEmail,
            create_without_access: createWithoutAccess,
          }];
        }
        return [];
      });

      if (links.length === 0) throw new Error('Selecciona al menos un trabajador para crear o vincular');

      const { data, error } = await supabase.functions.invoke('sync-employees-from-registro', {
        body: { mode: 'link', links },
      });
      if (error) throw error;
      return data as LinkResponse;
    },
    onSuccess: (data) => {
      toast({
        title: 'Trabajadores aplicados',
        description: `Vinculados: ${data.linked}. Creados: ${data.created}. Invitaciones: ${data.invitations_sent || 0}.`,
      });
      setInvitationDetails(data.invitation_details || []);
      setIsAccessDialogOpen(false);
      setPreview(null);
      setDecisions({});
      setSelectedIds(new Set());
      refetchLogs();
      queryClient.invalidateQueries({ queryKey: ['cleaners'] });
    },
    onError: (error) => {
      toast({ title: 'Error al aplicar cambios', description: getErrorMessage(error), variant: 'destructive' });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-employees-from-registro', {
        body: { mode: 'sync', include_inactive: includeInactive },
      });
      if (error) throw error;
      return data as { updated: number; deactivated: number };
    },
    onSuccess: (data) => {
      toast({
        title: 'Sincronización completada',
        description: `Actualizados: ${data.updated}. Desactivados: ${data.deactivated}.`,
      });
      refetchLogs();
      queryClient.invalidateQueries({ queryKey: ['cleaners'] });
    },
    onError: (error) => {
      toast({ title: 'Error al sincronizar', description: getErrorMessage(error), variant: 'destructive' });
    },
  });

  const invitePendingMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-employees-from-registro', {
        body: { mode: 'invite_pending' },
      });
      if (error) throw error;
      return data as { invitations_sent: number; details?: InvitationDetail[] };
    },
    onSuccess: (data) => {
      setInvitationDetails(data.details || []);
      toast({ title: 'Invitaciones reenviadas', description: `Enviadas: ${data.invitations_sent}.` });
    },
    onError: (error) => {
      toast({ title: 'Error al reinvitar', description: getErrorMessage(error), variant: 'destructive' });
    },
  });

  const matchBadge = (proposal: Proposal) => {
    switch (proposal.match_type) {
      case 'already_linked':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Ya vinculado</Badge>;
      case 'exact_name':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Coincidencia exacta</Badge>;
      case 'fuzzy_name':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Revisar similar</Badge>;
      case 'no_match':
        return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">NUEVO</Badge>;
    }
  };

  const invitationOutcomeLabel = (outcome: string) => {
    const labels: Record<string, string> = {
      invited: 'Invitación enviada',
      resent_pending: 'Invitación reenviada',
      already_has_access: 'Ya tenía acceso',
      no_email: 'Creada sin acceso',
      no_sede: 'Sin sede',
      email_failed: 'Email fallido',
      invite_error: 'Error invitando',
      error: 'Error',
    };
    return labels[outcome] || outcome;
  };

  const copyInvitationUrl = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      toast({ title: 'Enlace copiado', description: 'Puedes enviarlo manualmente a la trabajadora.' });
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Integraciones · REGISTRO</h1>
          <p className="text-sm text-muted-foreground">Importa solo los trabajadores de la app matriz que quieras gestionar aquí.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" /> Sincronización de empleados
          </CardTitle>
          <CardDescription>
            La vista previa no escribe nada. Después seleccionas manualmente a quién crear o vincular.
            La sincronización final solo actualiza trabajadores ya vinculados y no toca tareas asignadas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <Switch id="include-inactive" checked={includeInactive} onCheckedChange={setIncludeInactive} />
              <Label htmlFor="include-inactive">Incluir inactivos de REGISTRO</Label>
            </div>
            <Button onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending}>
              <RefreshCw className={`h-4 w-4 mr-2 ${previewMutation.isPending ? 'animate-spin' : ''}`} />
              Cargar vista previa
            </Button>
            <Button variant="secondary" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              Sincronizar ya vinculados
            </Button>
            <Button variant="outline" onClick={() => invitePendingMutation.mutate()} disabled={invitePendingMutation.isPending}>
              Reinvitar pendientes
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isAccessDialogOpen} onOpenChange={setIsAccessDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Confirmar acceso a la aplicación</DialogTitle>
            <DialogDescription>
              Revisa el email de acceso antes de crear o vincular trabajadoras desde REGISTRO. Si no indicas email, se crearán sin acceso.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {selectedActionableProposals.map((proposal) => {
              const decision = decisions[proposal.registro.id] || 'ignore';
              const confirmation = accessConfirmations[proposal.registro.id] || {
                email: '',
                createWithoutAccess: true,
              };

              return (
                <div key={proposal.registro.id} className="rounded-lg border p-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="font-semibold">{proposal.registro.name || 'Sin nombre'}</div>
                      <div className="text-xs text-muted-foreground">
                        {decision === 'create' ? 'Crear nueva trabajadora' : `Vincular con ${proposal.cleaner?.name || 'trabajadora existente'}`}
                      </div>
                      {decision === 'create' && (
                        <div className="text-xs text-muted-foreground">
                          Sede: {sedes.find((sede) => sede.id === createSedeId)?.nombre || 'Sin sede seleccionada'}
                        </div>
                      )}
                    </div>
                    <Badge variant={confirmation.createWithoutAccess ? 'outline' : 'secondary'}>
                      {confirmation.createWithoutAccess ? 'Sin acceso' : 'Enviar invitación'}
                    </Badge>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                    <div className="space-y-1">
                      <Label>Email de acceso</Label>
                      <Input
                        type="email"
                        value={confirmation.email}
                        disabled={confirmation.createWithoutAccess}
                        placeholder="trabajadora@ejemplo.com"
                        onChange={(event) =>
                          setAccessConfirmation(proposal.registro.id, {
                            email: event.target.value,
                            createWithoutAccess: false,
                          })
                        }
                      />
                    </div>
                    <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <Checkbox
                        checked={confirmation.createWithoutAccess}
                        onCheckedChange={(checked) =>
                          setAccessConfirmation(proposal.registro.id, {
                            createWithoutAccess: checked === true,
                          })
                        }
                      />
                      Crear sin acceso
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsAccessDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={confirmAccessAndApply} disabled={linkMutation.isPending}>
              {linkMutation.isPending ? 'Aplicando...' : 'Crear/vincular e invitar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {invitationDetails.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado de accesos</CardTitle>
            <CardDescription>
              Detalle de invitaciones generadas, reenviadas o pendientes de revisar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {invitationDetails.map((detail, index) => (
              <div key={`${detail.external_id || detail.cleaner_id || index}-${detail.outcome}`} className="flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={detail.outcome.includes('error') || detail.outcome.includes('failed') ? 'destructive' : 'secondary'}>
                      {invitationOutcomeLabel(detail.outcome)}
                    </Badge>
                    <span className="font-medium">{detail.email || 'Sin email'}</span>
                  </div>
                  {detail.error && <p className="mt-1 text-xs text-red-600">{detail.error}</p>}
                  {detail.outcome === 'no_email' && (
                    <p className="mt-1 text-xs text-muted-foreground">La trabajadora se creó o vinculó, pero todavía no puede acceder a la app.</p>
                  )}
                </div>
                {detail.invitation_url && (
                  <Button variant="outline" size="sm" onClick={() => copyInvitationUrl(detail.invitation_url!)}>
                    Copiar enlace
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {preview && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" /> Revisión de trabajadores
                </CardTitle>
                <CardDescription>
                  REGISTRO: {preview.summary.registro_total} · Vinculados: {preview.summary.already_linked} ·
                  Exactos: {preview.summary.exact} · Similares: {preview.summary.fuzzy} · Nuevos: {preview.summary.no_match}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{selectedIds.size} seleccionados</Badge>
                <Badge variant="outline">{selectedSummary.create} crear</Badge>
                <Badge variant="outline">{selectedSummary.link} vincular</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_220px_260px_auto] lg:items-end">
              <div className="space-y-2">
                <Label>Buscar trabajador</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Nombre, email, DNI, categoría..."
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Filtro</Label>
                <Select value={filter} onValueChange={(value) => setFilter(value as ProposalFilter)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendientes</SelectItem>
                    <SelectItem value="new">Nuevos</SelectItem>
                    <SelectItem value="similar">Similares</SelectItem>
                    <SelectItem value="exact">Exactos</SelectItem>
                    <SelectItem value="linked">Ya vinculados</SelectItem>
                    <SelectItem value="selected">Seleccionados</SelectItem>
                    <SelectItem value="all">Todos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sede para nuevos</Label>
                <Select value={createSedeId} onValueChange={setCreateSedeId}>
                  <SelectTrigger><SelectValue placeholder="Selecciona sede" /></SelectTrigger>
                  <SelectContent>
                    {sedes.map((sede) => <SelectItem key={sede.id} value={sede.id}>{sede.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleApplySelection} disabled={linkMutation.isPending || selectedIds.size === 0}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Aplicar selección
              </Button>
            </div>

            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <div className="flex items-center gap-2">
                <Checkbox checked={allVisibleSelected} onCheckedChange={(checked) => toggleVisibleSelection(checked === true)} />
                <span className="text-sm">Seleccionar visibles ({actionableVisibleIds.length})</span>
              </div>
              <span className="text-sm text-muted-foreground">{filteredProposals.length} resultados</span>
            </div>

            <div className="grid gap-3">
              {filteredProposals.map((proposal) => {
                const isLinked = proposal.match_type === 'already_linked';
                const isSelected = selectedIds.has(proposal.registro.id);
                const decision = decisions[proposal.registro.id] || 'ignore';

                return (
                  <div
                    key={proposal.registro.id}
                    className={`rounded-lg border p-4 ${
                      proposal.match_type === 'no_match'
                        ? 'border-emerald-300 bg-emerald-50/70'
                        : ''
                    }`}
                  >
                    <div className="grid gap-4 lg:grid-cols-[32px_1.3fr_1fr_190px] lg:items-center">
                      <Checkbox
                        checked={isSelected}
                        disabled={isLinked}
                        onCheckedChange={(checked) => toggleSelection(proposal.registro.id, checked === true)}
                      />

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{proposal.registro.name || 'Sin nombre'}</span>
                          {matchBadge(proposal)}
                          {proposal.registro.is_active === false && <Badge variant="outline">Inactivo</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {proposal.registro.email || 'Sin email'} · {proposal.registro.phone || 'Sin teléfono'} · {proposal.registro.dni || 'Sin DNI'}
                        </div>
                        {(proposal.registro.category || proposal.registro.delegation_name || proposal.registro.office_name) && (
                          <div className="text-xs text-muted-foreground">
                            {[proposal.registro.category, proposal.registro.delegation_name, proposal.registro.office_name].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>

                      <div className="text-sm">
                        {proposal.cleaner ? (
                          <>
                            <div className="text-muted-foreground text-xs">Coincidencia en GESTIÓN</div>
                            <div className="font-medium">{proposal.cleaner.name}</div>
                            <div className="text-xs text-muted-foreground">{proposal.cleaner.email || 'Sin email local'}</div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">No existe en GESTIÓN</span>
                        )}
                      </div>

                      {isLinked ? (
                        <div className="text-sm text-muted-foreground">Sin acción necesaria</div>
                      ) : (
                        <Select value={decision} onValueChange={(value) => setDecision(proposal.registro.id, value as Decision)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {proposal.cleaner && <SelectItem value="link">Vincular existente</SelectItem>}
                            <SelectItem value="create">Crear nuevo</SelectItem>
                            <SelectItem value="ignore">Ignorar</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredProposals.length === 0 && (
                <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                  No hay trabajadores que coincidan con este filtro.
                </div>
              )}
            </div>

            {preview.gestion_unmatched.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  {preview.gestion_unmatched.length} trabajadores de GESTIÓN no aparecen vinculados a REGISTRO
                </div>
                <p className="mt-1 text-xs">Se conservan intactos. No se desactivan ni pierden tareas.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" /> Histórico de sincronizaciones
          </CardTitle>
          <CardDescription>Últimas 20 ejecuciones</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 text-left">Fecha</th>
                  <th className="p-2 text-left">Tipo</th>
                  <th className="p-2 text-left">Modo</th>
                  <th className="p-2 text-right">Recibidos</th>
                  <th className="p-2 text-right">Vinc.</th>
                  <th className="p-2 text-right">Creados</th>
                  <th className="p-2 text-right">Actualizados</th>
                  <th className="p-2 text-right">Desact.</th>
                  <th className="p-2 text-left">Estado</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t">
                    <td className="p-2">{new Date(log.run_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</td>
                    <td className="p-2">{log.triggered_by}</td>
                    <td className="p-2">{log.dry_run ? 'vista previa' : 'real'}</td>
                    <td className="p-2 text-right">{log.fetched}</td>
                    <td className="p-2 text-right">{log.linked}</td>
                    <td className="p-2 text-right">{log.created}</td>
                    <td className="p-2 text-right">{log.updated}</td>
                    <td className="p-2 text-right">{log.deactivated}</td>
                    <td className="p-2">
                      {log.success ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">OK</Badge>
                      ) : (
                        <Badge variant="destructive">Error</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Separator />
      <p className="text-xs text-muted-foreground">
        Endpoint REGISTRO: <code>https://rnipyxdozvrqevrfyaif.supabase.co/functions/v1/employees-api</code>
      </p>
    </div>
  );
};

export default Integraciones;
