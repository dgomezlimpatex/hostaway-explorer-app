import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, RefreshCw, Link as LinkIcon, AlertTriangle, CheckCircle2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type Proposal = {
  registro: { id: string; name: string; email?: string | null; is_active?: boolean | null };
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

const Integraciones = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [includeInactive, setIncludeInactive] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [decisions, setDecisions] = useState<Record<string, 'link' | 'create' | 'ignore'>>({});
  const [createSedeId, setCreateSedeId] = useState<string>('');

  // Sedes para crear nuevos cleaners
  const { data: sedes } = useQuery({
    queryKey: ['sedes-active'],
    queryFn: async () => {
      const { data } = await supabase.from('sedes').select('id, nombre').eq('is_active', true).order('nombre');
      return data || [];
    },
  });

  // Logs de sincronización
  const { data: logs, refetch: refetchLogs } = useQuery({
    queryKey: ['employee-sync-logs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('employee_sync_log')
        .select('*')
        .order('run_at', { ascending: false })
        .limit(20);
      return data || [];
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
      setPreview(data);
      // Pre-seleccionar decisiones por defecto
      const def: Record<string, 'link' | 'create' | 'ignore'> = {};
      for (const p of data.proposals) {
        if (p.match_type === 'exact_name') def[p.registro.id] = 'link';
        else if (p.match_type === 'no_match') def[p.registro.id] = 'create';
        else if (p.match_type === 'fuzzy_name') def[p.registro.id] = 'ignore';
      }
      setDecisions(def);
      refetchLogs();
      toast({ title: 'Vista previa lista', description: `${data.summary.registro_total} empleados en REGISTRO` });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const linkMutation = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error('Sin preview');
      const links: any[] = [];
      for (const p of preview.proposals) {
        const d = decisions[p.registro.id];
        if (!d || d === 'ignore') continue;
        if (d === 'link' && p.cleaner) {
          links.push({ external_id: p.registro.id, cleaner_id: p.cleaner.id });
        } else if (d === 'create') {
          if (!createSedeId) throw new Error('Selecciona una sede para los nuevos empleados');
          links.push({
            external_id: p.registro.id,
            create_new: true,
            sede_id: createSedeId,
            snapshot: {
              name: p.registro.name,
              is_active: p.registro.is_active,
            },
          });
        }
      }
      if (links.length === 0) throw new Error('No hay decisiones para aplicar');
      const { data, error } = await supabase.functions.invoke('sync-employees-from-registro', {
        body: { mode: 'link', links },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Vinculación aplicada',
        description: `Vinculados: ${data.linked} · Creados: ${data.created} · Errores: ${data.errors?.length || 0}`,
      });
      setPreview(null);
      setDecisions({});
      refetchLogs();
      queryClient.invalidateQueries({ queryKey: ['cleaners'] });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-employees-from-registro', {
        body: { mode: 'sync', include_inactive: includeInactive },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Sincronización completada',
        description: `Actualizados: ${data.updated} · Desactivados: ${data.deactivated}`,
      });
      refetchLogs();
      queryClient.invalidateQueries({ queryKey: ['cleaners'] });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const matchBadge = (t: Proposal['match_type']) => {
    switch (t) {
      case 'exact_name':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">✅ Nombre exacto</Badge>;
      case 'fuzzy_name':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">⚠️ Nombre similar</Badge>;
      case 'already_linked':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">🔗 Ya vinculado</Badge>;
      case 'no_match':
        return <Badge variant="outline">➕ Sin match</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver
        </Button>
        <h1 className="text-2xl font-bold">Integraciones · REGISTRO</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LinkIcon className="h-5 w-5" /> Sincronización de empleados</CardTitle>
          <CardDescription>
            Importa los empleados desde REGISTRO sin afectar las tareas asignadas en GESTIÓN.
            Los emails y teléfonos guardados aquí <strong>nunca se sobreescriben</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch id="incl-inactive" checked={includeInactive} onCheckedChange={setIncludeInactive} />
            <Label htmlFor="incl-inactive">Incluir empleados inactivos de REGISTRO</Label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending}>
              <RefreshCw className={`h-4 w-4 mr-2 ${previewMutation.isPending ? 'animate-spin' : ''}`} />
              1. Vista previa (dry-run)
            </Button>
            <Button
              variant="secondary"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              3. Sincronizar vinculados
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            <strong>Flujo:</strong> 1) Vista previa → 2) Revisa la tabla y aplica vinculaciones → 3) Sincroniza para refrescar datos de los ya vinculados.
            La sincronización solo afecta empleados con vinculación previa y nunca toca tus tareas.
          </p>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>2. Revisión y vinculación</CardTitle>
            <CardDescription>
              REGISTRO: {preview.summary.registro_total} · Ya vinculados: {preview.summary.already_linked} ·
              Match exacto: {preview.summary.exact} · Similar: {preview.summary.fuzzy} ·
              Sin match: {preview.summary.no_match}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Label>Sede para nuevos empleados:</Label>
              <Select value={createSedeId} onValueChange={setCreateSedeId}>
                <SelectTrigger className="w-64"><SelectValue placeholder="Selecciona sede" /></SelectTrigger>
                <SelectContent>
                  {sedes?.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button
                onClick={() => linkMutation.mutate()}
                disabled={linkMutation.isPending}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" /> Aplicar decisiones
              </Button>
            </div>

            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 text-left">REGISTRO</th>
                    <th className="p-2 text-left">GESTIÓN</th>
                    <th className="p-2 text-left">Match</th>
                    <th className="p-2 text-left">Decisión</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.proposals.map((p) => (
                    <tr key={p.registro.id} className="border-t">
                      <td className="p-2">
                        <div className="font-medium">{p.registro.name}</div>
                        <div className="text-xs text-muted-foreground">{p.registro.email || '—'}</div>
                        {p.registro.is_active === false && <Badge variant="outline" className="mt-1">inactivo</Badge>}
                      </td>
                      <td className="p-2">
                        {p.cleaner ? (
                          <>
                            <div className="font-medium">{p.cleaner.name}</div>
                            <div className="text-xs text-muted-foreground">{p.cleaner.email || '—'}</div>
                          </>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="p-2">{matchBadge(p.match_type)}</td>
                      <td className="p-2">
                        {p.match_type === 'already_linked' ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <Select
                            value={decisions[p.registro.id] || 'ignore'}
                            onValueChange={(v: any) => setDecisions(prev => ({ ...prev, [p.registro.id]: v }))}
                          >
                            <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {p.cleaner && <SelectItem value="link">Vincular existente</SelectItem>}
                              <SelectItem value="create">Crear nuevo</SelectItem>
                              <SelectItem value="ignore">Ignorar</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {preview.gestion_unmatched.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
                <div className="flex items-center gap-2 font-medium text-amber-900 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  {preview.gestion_unmatched.length} empleados de GESTIÓN sin coincidencia en REGISTRO
                </div>
                <div className="text-amber-900 text-xs">
                  Estos empleados se conservan intactos (con sus tareas). No se vinculan ni se desactivan.
                </div>
                <ul className="mt-2 text-xs text-amber-900 list-disc pl-5">
                  {preview.gestion_unmatched.slice(0, 30).map(c => <li key={c.id}>{c.name}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Histórico de sincronizaciones</CardTitle>
          <CardDescription>Últimas 20 ejecuciones</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
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
                  <th className="p-2 text-right">Desactivados</th>
                  <th className="p-2 text-left">Estado</th>
                </tr>
              </thead>
              <tbody>
                {logs?.map((l: any) => (
                  <tr key={l.id} className="border-t">
                    <td className="p-2">{new Date(l.run_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</td>
                    <td className="p-2">{l.triggered_by}</td>
                    <td className="p-2">{l.dry_run ? 'dry-run' : 'real'}</td>
                    <td className="p-2 text-right">{l.fetched}</td>
                    <td className="p-2 text-right">{l.linked}</td>
                    <td className="p-2 text-right">{l.created}</td>
                    <td className="p-2 text-right">{l.updated}</td>
                    <td className="p-2 text-right">{l.deactivated}</td>
                    <td className="p-2">
                      {l.success ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100">OK</Badge>
                        : <Badge variant="destructive">Error</Badge>}
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
