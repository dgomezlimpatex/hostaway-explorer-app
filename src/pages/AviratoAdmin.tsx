import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, ArrowLeft, CheckCircle2, Hotel, Pencil, Play, Plus, RefreshCw, Search, Trash2 } from "lucide-react";

type ServiceKind = "checkout" | "stay";

interface AviratoReservation {
  id: string;
  external_id: string;
  operator_booking_id: string | null;
  check_in: string;
  check_out: string;
  space_subtype_id: number | null;
  space_name: string;
  space_subtype_name: string | null;
  guest_name: string | null;
  adults: number | null;
  children: number | null;
  status: string;
  normalized_status: string;
  agency: string | null;
  total_amount: number | null;
  synced_at: string | null;
  created_at: string;
}

interface AviratoMapping {
  id: string;
  sede_id: string;
  space_subtype_id: number;
  space_name: string;
  service_kind: ServiceKind;
  cliente_id: string;
  propiedad_id: string;
  task_type: string;
  default_start_time: string;
  default_duration_min: number;
  default_cost: number;
  is_active: boolean;
}

interface AviratoSyncLog {
  id: string;
  triggered_by: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  reservations_processed: number | null;
  reservations_new: number | null;
  reservations_updated: number | null;
  reservations_cancelled: number | null;
  blocks_detected: number | null;
  stay_tasks_created: number | null;
  checkout_tasks_created: number | null;
  tasks_cancelled: number | null;
  warnings: string[] | null;
  errors: string[] | null;
  started_at: string;
  completed_at: string | null;
}

interface AviratoSyncError {
  id: string;
  error_type: string;
  message: string;
  details: Record<string, unknown> | null;
  resolved: boolean;
  created_at: string;
}

interface PreviewSpace {
  space_subtype_id: number;
  space_name: string;
  reservations: number;
}

interface AviratoPreview {
  summary?: {
    reservations?: number;
    active?: number;
    cancelled?: number;
    blocks?: number;
    detectedSpaces?: number;
  };
  spaces?: PreviewSpace[];
}

type DetectedSpace = {
  space_subtype_id: number;
  space_name: string;
  space_subtype_name: string | null;
};

function fromUntypedTable(table: string) {
  return supabase.from(table as never);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message?: unknown }).message);
  }
  return "Error desconocido";
}

function normalizeDurationMinutes(value: unknown, fallback = 60): number {
  const duration = Number(value);
  if (!Number.isFinite(duration)) return fallback;
  return Math.max(1, Math.round(duration));
}

function parseDecimalInput(value: string): number {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function getFunctionErrorMessage(error: unknown): Promise<string> {
  const context = typeof error === "object" && error && "context" in error
    ? (error as { context?: Response }).context
    : undefined;
  if (context) {
    const body = await context.clone().json().catch(() => null) as { error?: string; requiredSecrets?: string[] } | null;
    if (body?.requiredSecrets?.length) return `Faltan secrets: ${body.requiredSecrets.join(", ")}`;
    if (body?.error) return body.error;
  }
  return getErrorMessage(error);
}

const STATUS_BADGE: Record<string, string> = {
  confirmed: "bg-green-100 text-green-800",
  check_in: "bg-blue-100 text-blue-800",
  cancelled: "bg-red-100 text-red-800",
  deleted: "bg-red-100 text-red-800",
  no_show: "bg-slate-100 text-slate-800",
  block: "bg-amber-100 text-amber-900",
};

export default function AviratoAdmin() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto max-w-7xl space-y-5 p-4 pb-24 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Volver
          </Button>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Hotel className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Avirato Hotel</h1>
            <p className="text-sm text-muted-foreground">Reservas hoteleras con limpiezas diarias y checkout.</p>
          </div>
        </div>
      </div>

      <AviratoActions />

      <Tabs defaultValue="reservations" className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="reservations">Reservas</TabsTrigger>
            <TabsTrigger value="mappings">Mapeos</TabsTrigger>
            <TabsTrigger value="alerts">Revision</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="reservations"><ReservationsTab /></TabsContent>
        <TabsContent value="mappings"><MappingsTab /></TabsContent>
        <TabsContent value="alerts"><AlertsTab /></TabsContent>
        <TabsContent value="logs"><LogsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function AviratoActions() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [preview, setPreview] = useState<AviratoPreview | null>(null);

  const callFunction = useMutation({
    mutationFn: async (mode: "test" | "preview" | "sync") => {
      const { data, error } = await supabase.functions.invoke("avirato-sync", {
        body: { mode, startDate: startDate || undefined, endDate: endDate || undefined, triggered_by: "manual" },
      });
      if (error) throw new Error(await getFunctionErrorMessage(error));
      if (data?.success === false) throw new Error(data.error || "Error Avirato");
      return { mode, data };
    },
    onSuccess: ({ mode, data }) => {
      if (mode === "preview") {
        setPreview(data);
        toast({ title: "Vista previa lista", description: `${data.summary?.reservations ?? 0} reservas encontradas.` });
        return;
      }
      if (mode === "test") {
        toast({ title: "Conexion correcta", description: "Avirato respondio correctamente." });
        return;
      }
      toast({ title: "Sincronizacion completada", description: `${data.stats?.reservations_processed ?? 0} reservas procesadas.` });
      setPreview(null);
      qc.invalidateQueries({ queryKey: ["avirato-reservations"] });
      qc.invalidateQueries({ queryKey: ["avirato-logs"] });
      qc.invalidateQueries({ queryKey: ["avirato-errors"] });
      qc.invalidateQueries({ queryKey: ["avirato-detected-spaces"] });
    },
    onError: (error: unknown) => {
      toast({ title: "Error en Avirato", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5" /> Control de sincronizacion</CardTitle>
        <CardDescription>El cron queda inactivo hasta validar mapeos y una sincronizacion manual.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[160px_160px_1fr]">
          <div>
            <Label className="text-xs">Desde</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Hasta</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Button variant="outline" onClick={() => callFunction.mutate("test")} disabled={callFunction.isPending}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Probar conexion
            </Button>
            <Button variant="outline" onClick={() => callFunction.mutate("preview")} disabled={callFunction.isPending}>
              <Search className="mr-2 h-4 w-4" /> Vista previa
            </Button>
            <Button onClick={() => callFunction.mutate("sync")} disabled={callFunction.isPending}>
              {callFunction.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Sincronizar ahora
            </Button>
          </div>
        </div>

        {preview && (
          <div className="rounded-xl border bg-slate-50 p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge variant="secondary">{preview.summary?.reservations ?? 0} reservas</Badge>
              <Badge className="bg-green-100 text-green-800">{preview.summary?.active ?? 0} activas</Badge>
              <Badge className="bg-red-100 text-red-800">{preview.summary?.cancelled ?? 0} canceladas</Badge>
              <Badge className="bg-amber-100 text-amber-900">{preview.summary?.blocks ?? 0} bloqueos</Badge>
              <Badge variant="outline">{preview.summary?.detectedSpaces ?? 0} alojamientos</Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {(preview.spaces ?? []).slice(0, 12).map((space) => (
                <div key={space.space_subtype_id} className="rounded-lg border bg-white p-3">
                  <p className="font-medium">{space.space_name}</p>
                  <p className="text-xs text-muted-foreground">ID {space.space_subtype_id} - {space.reservations} reservas</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReservationsTab() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { data, isLoading } = useQuery({
    queryKey: ["avirato-reservations"],
    queryFn: async () => {
      const { data, error } = await fromUntypedTable("avirato_reservations").select("*").order("check_in", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as AviratoReservation[];
    },
  });
  const filtered = useMemo(() => (data ?? []).filter((reservation) => {
    if (statusFilter !== "all" && reservation.normalized_status !== statusFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return reservation.space_name.toLowerCase().includes(s) ||
      (reservation.guest_name ?? "").toLowerCase().includes(s) ||
      (reservation.operator_booking_id ?? reservation.external_id).toLowerCase().includes(s);
  }), [data, search, statusFilter]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reservas importadas</CardTitle>
        <CardDescription>Ultimas 500 reservas espejo recibidas desde Avirato.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label className="text-xs">Buscar</Label>
            <Input placeholder="Huesped, referencia o alojamiento..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Estado</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="confirmed">Confirmadas</SelectItem>
                <SelectItem value="check_in">Check In</SelectItem>
                <SelectItem value="block">Bloqueos</SelectItem>
                <SelectItem value="cancelled">Canceladas</SelectItem>
                <SelectItem value="deleted">Eliminadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? <p className="text-muted-foreground">Cargando...</p> : filtered.length === 0 ? (
          <p className="text-muted-foreground">Sin reservas importadas todavia.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estado</TableHead>
                  <TableHead>Alojamiento</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Salida</TableHead>
                  <TableHead className="text-right">Noches</TableHead>
                  <TableHead>Huesped</TableHead>
                  <TableHead>Canal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((reservation) => {
                  const nights = Math.max(0, Math.round((new Date(reservation.check_out).getTime() - new Date(reservation.check_in).getTime()) / 86400000));
                  return (
                    <TableRow key={reservation.id}>
                      <TableCell><Badge className={STATUS_BADGE[reservation.normalized_status] ?? ""}>{reservation.status}</Badge></TableCell>
                      <TableCell>
                        <p className="font-medium">{reservation.space_name}</p>
                        <p className="text-xs text-muted-foreground">ID {reservation.space_subtype_id ?? "-"}</p>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{reservation.operator_booking_id ?? reservation.external_id}</TableCell>
                      <TableCell>{reservation.check_in}</TableCell>
                      <TableCell>{reservation.check_out}</TableCell>
                      <TableCell className="text-right">{nights}</TableCell>
                      <TableCell>{reservation.guest_name ?? "-"}</TableCell>
                      <TableCell>{reservation.agency ?? "-"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MappingsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<AviratoMapping> | null>(null);
  const [open, setOpen] = useState(false);

  const { data: mappings } = useQuery({
    queryKey: ["avirato-mappings"],
    queryFn: async () => {
      const { data, error } = await fromUntypedTable("avirato_room_mapping").select("*").order("space_name").order("service_kind");
      if (error) throw error;
      return (data ?? []) as unknown as AviratoMapping[];
    },
  });
  const { data: detectedSpaces } = useQuery({
    queryKey: ["avirato-detected-spaces"],
    queryFn: async () => {
      const { data, error } = await fromUntypedTable("avirato_reservations").select("space_subtype_id, space_name, space_subtype_name").not("space_subtype_id", "is", null);
      if (error) throw error;
      const map = new Map<number, DetectedSpace>();
      ((data ?? []) as DetectedSpace[]).forEach((row) => {
        if (row.space_subtype_id !== null && !map.has(row.space_subtype_id)) map.set(row.space_subtype_id, row);
      });
      return Array.from(map.values()).sort((a, b) => a.space_name.localeCompare(b.space_name));
    },
  });
  const { data: sedes } = useQuery({
    queryKey: ["sedes-active"],
    queryFn: async () => (await supabase.from("sedes").select("id, nombre").eq("is_active", true).order("nombre")).data ?? [],
  });
  const { data: clients } = useQuery({
    queryKey: ["clients-all"],
    queryFn: async () => (await supabase.from("clients").select("id, nombre").order("nombre")).data ?? [],
  });
  const { data: properties } = useQuery({
    queryKey: ["properties-all"],
    queryFn: async () => (await supabase.from("properties").select("id, nombre, cliente_id, sede_id").order("nombre")).data ?? [],
  });

  const saveMutation = useMutation({
    mutationFn: async (mapping: Partial<AviratoMapping>) => {
      const normalizedDuration = normalizeDurationMinutes(mapping.default_duration_min);
      const payload = {
        sede_id: mapping.sede_id,
        space_subtype_id: Number(mapping.space_subtype_id),
        space_name: mapping.space_name,
        service_kind: mapping.service_kind,
        cliente_id: mapping.cliente_id,
        propiedad_id: mapping.propiedad_id,
        task_type: mapping.task_type || "limpieza-turistica",
        default_start_time: mapping.default_start_time || "11:00",
        default_duration_min: normalizedDuration,
        default_cost: mapping.default_cost ?? 0,
        is_active: mapping.is_active ?? true,
      };
      const query = mapping.id
        ? fromUntypedTable("avirato_room_mapping").update(payload).eq("id", mapping.id)
        : fromUntypedTable("avirato_room_mapping").insert(payload);
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Mapeo guardado" });
      qc.invalidateQueries({ queryKey: ["avirato-mappings"] });
      setOpen(false);
      setEditing(null);
    },
    onError: (error: unknown) => toast({ title: "Error guardando mapeo", description: getErrorMessage(error), variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromUntypedTable("avirato_room_mapping").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Mapeo eliminado" });
      qc.invalidateQueries({ queryKey: ["avirato-mappings"] });
    },
  });
  const mappedKeys = new Set((mappings ?? []).map((m) => `${m.space_subtype_id}|${m.service_kind}`));
  const missing = (detectedSpaces ?? []).map((space) => {
    const missingKinds: ServiceKind[] = [];
    if (!mappedKeys.has(`${space.space_subtype_id}|checkout`)) missingKinds.push("checkout");
    if (!mappedKeys.has(`${space.space_subtype_id}|stay`)) missingKinds.push("stay");
    return { ...space, missingKinds };
  }).filter((space) => space.missingKinds.length > 0);
  const openNew = (prefill?: Partial<AviratoMapping>) => {
    setEditing({ service_kind: "checkout", task_type: "limpieza-turistica", default_start_time: "11:00", default_duration_min: 60, default_cost: 0, is_active: true, ...prefill });
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      {missing.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900"><AlertTriangle className="h-5 w-5" /> Alojamientos sin mapeo completo</CardTitle>
            <CardDescription className="text-amber-900">Cada alojamiento necesita un mapeo de salida y otro de limpieza diaria.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {missing.map((space) => (
              <div key={space.space_subtype_id} className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{space.space_name}</p>
                  <p className="text-xs text-amber-800">ID {space.space_subtype_id} - falta {space.missingKinds.join(", ")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {space.missingKinds.map((kind) => (
                    <Button key={kind} size="sm" variant="outline" onClick={() => openNew({ space_subtype_id: space.space_subtype_id, space_name: space.space_name, service_kind: kind })}>
                      <Plus className="mr-1 h-3 w-3" /> {kind}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Mapeos Avirato</CardTitle>
            <CardDescription>Vincula spaceSubtypeId con sede, cliente, propiedad y configuracion de tarea.</CardDescription>
          </div>
          <Button onClick={() => openNew()}><Plus className="mr-2 h-4 w-4" /> Nuevo mapeo</Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alojamiento</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Propiedad</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead className="text-right">Duracion</TableHead>
                  <TableHead className="text-right">Coste</TableHead>
                  <TableHead>Activo</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(mappings ?? []).map((mapping) => {
                  const property = (properties ?? []).find((p) => p.id === mapping.propiedad_id);
                  return (
                    <TableRow key={mapping.id}>
                      <TableCell><p className="font-medium">{mapping.space_name}</p><p className="text-xs text-muted-foreground">ID {mapping.space_subtype_id}</p></TableCell>
                      <TableCell><Badge variant={mapping.service_kind === "checkout" ? "default" : "secondary"}>{mapping.service_kind === "checkout" ? "Salida" : "Diaria"}</Badge></TableCell>
                      <TableCell>{property?.nombre ?? mapping.propiedad_id}</TableCell>
                      <TableCell>{mapping.default_start_time}</TableCell>
                      <TableCell className="text-right">{mapping.default_duration_min} min</TableCell>
                      <TableCell className="text-right">{mapping.default_cost} EUR</TableCell>
                      <TableCell>{mapping.is_active ? "Si" : "No"}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(mapping); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm("Eliminar este mapeo?")) deleteMutation.mutate(mapping.id); }}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <MappingDialog
        open={open}
        onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setEditing(null); }}
        editing={editing}
        setEditing={setEditing}
        sedes={sedes ?? []}
        clients={clients ?? []}
        properties={properties ?? []}
        onSave={(mapping) => saveMutation.mutate(mapping)}
        saving={saveMutation.isPending}
      />
    </div>
  );
}

function MappingDialog({
  open,
  onOpenChange,
  editing,
  setEditing,
  sedes,
  clients,
  properties,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Partial<AviratoMapping> | null;
  setEditing: (mapping: Partial<AviratoMapping> | null) => void;
  sedes: Array<{ id: string; nombre: string }>;
  clients: Array<{ id: string; nombre: string }>;
  properties: Array<{ id: string; nombre: string; cliente_id: string; sede_id: string }>;
  onSave: (mapping: Partial<AviratoMapping>) => void;
  saving: boolean;
}) {
  if (!editing) return null;
  const filteredProps = editing.cliente_id ? properties.filter((property) => property.cliente_id === editing.cliente_id) : properties;
  const normalizedDuration = normalizeDurationMinutes(editing.default_duration_min);
  const durationWasAdjusted = Number(editing.default_duration_min) !== normalizedDuration;
  const update = (patch: Partial<AviratoMapping>) => setEditing({ ...editing, ...patch });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing.id ? "Editar mapeo" : "Nuevo mapeo"}</DialogTitle>
          <DialogDescription>Avirato necesita un mapeo para checkout y otro para limpieza diaria.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="spaceSubtypeId"><Input type="number" value={editing.space_subtype_id ?? ""} onChange={(e) => update({ space_subtype_id: Number(e.target.value) })} /></Field>
          <Field label="Nombre visible"><Input value={editing.space_name ?? ""} onChange={(e) => update({ space_name: e.target.value })} /></Field>
          <Field label="Tipo de servicio">
            <Select value={editing.service_kind} onValueChange={(value: ServiceKind) => update({ service_kind: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="checkout">Salida checkout</SelectItem><SelectItem value="stay">Limpieza diaria</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Sede">
            <Select value={editing.sede_id} onValueChange={(value) => update({ sede_id: value })}>
              <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>{sedes.map((sede) => <SelectItem key={sede.id} value={sede.id}>{sede.nombre}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Cliente">
            <Select value={editing.cliente_id} onValueChange={(value) => update({ cliente_id: value, propiedad_id: undefined })}>
              <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.nombre}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Propiedad">
            <Select
              value={editing.propiedad_id}
              onValueChange={(value) => {
                const property = properties.find((p) => p.id === value);
                update({ propiedad_id: value, cliente_id: property?.cliente_id ?? editing.cliente_id, sede_id: property?.sede_id ?? editing.sede_id });
              }}
            >
              <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>{filteredProps.map((property) => <SelectItem key={property.id} value={property.id}>{property.nombre}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Tipo de tarea"><Input value={editing.task_type ?? "limpieza-turistica"} onChange={(e) => update({ task_type: e.target.value })} /></Field>
          <Field label="Hora inicio"><Input type="time" value={editing.default_start_time ?? "11:00"} onChange={(e) => update({ default_start_time: e.target.value })} /></Field>
          <Field label="Duracion min">
            <Input
              type="number"
              min={1}
              step={1}
              value={editing.default_duration_min ?? 60}
              onBlur={() => update({ default_duration_min: normalizedDuration })}
              onChange={(e) => update({ default_duration_min: Number(e.target.value) })}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Minutos exactos. {durationWasAdjusted ? `Se guardara como ${normalizedDuration} min.` : "Ejemplo: 33, 70, 95."}
            </p>
          </Field>
          <Field label="Coste"><Input inputMode="decimal" value={editing.default_cost ?? 0} onChange={(e) => update({ default_cost: parseDecimalInput(e.target.value) })} /></Field>
          <Field label="Activo">
            <Select value={editing.is_active === false ? "false" : "true"} onValueChange={(value) => update({ is_active: value === "true" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="true">Si</SelectItem><SelectItem value="false">No</SelectItem></SelectContent>
            </Select>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={saving || !editing.space_subtype_id || !editing.space_name || !editing.service_kind || !editing.sede_id || !editing.cliente_id || !editing.propiedad_id} onClick={() => onSave(editing)}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label>{label}</Label>{children}</div>;
}

function AlertsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data } = useQuery({
    queryKey: ["avirato-errors"],
    queryFn: async () => {
      const { data, error } = await fromUntypedTable("avirato_sync_errors").select("*").eq("resolved", false).order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as AviratoSyncError[];
    },
  });
  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromUntypedTable("avirato_sync_errors").update({ resolved: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Aviso resuelto" });
      qc.invalidateQueries({ queryKey: ["avirato-errors"] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bloqueos, errores y revisiones</CardTitle>
        <CardDescription>Aqui aparecen bloqueos importados, alojamientos sin mapeo y errores accionables.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {(data ?? []).length === 0 ? <p className="text-muted-foreground">No hay avisos pendientes.</p> : (data ?? []).map((error) => (
          <div key={error.id} className="rounded-xl border p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Badge variant="outline">{error.error_type}</Badge>
                <p className="mt-2 font-medium">{error.message}</p>
                <p className="text-xs text-muted-foreground">{new Date(error.created_at).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}</p>
                {error.details && <pre className="mt-2 max-h-28 overflow-auto rounded-lg bg-slate-50 p-2 text-xs">{JSON.stringify(error.details, null, 2)}</pre>}
              </div>
              <Button size="sm" variant="outline" onClick={() => resolveMutation.mutate(error.id)}>Marcar resuelto</Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function LogsTab() {
  const { data } = useQuery({
    queryKey: ["avirato-logs"],
    queryFn: async () => {
      const { data, error } = await fromUntypedTable("avirato_sync_logs").select("*").order("started_at", { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as AviratoSyncLog[];
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Logs de sincronizacion</CardTitle>
        <CardDescription>Auditoria de ejecuciones manuales y futuras ejecuciones cron.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inicio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Rango</TableHead>
                <TableHead className="text-right">Reservas</TableHead>
                <TableHead className="text-right">Tareas</TableHead>
                <TableHead className="text-right">Avisos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs">{new Date(log.started_at).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}</TableCell>
                  <TableCell><Badge variant={log.status === "completed" ? "default" : "secondary"}>{log.status}</Badge></TableCell>
                  <TableCell className="text-xs">{log.start_date ?? "-"} / {log.end_date ?? "-"}</TableCell>
                  <TableCell className="text-right">{log.reservations_processed ?? 0}<span className="ml-1 text-xs text-muted-foreground">(+{log.reservations_new ?? 0} / upd {log.reservations_updated ?? 0})</span></TableCell>
                  <TableCell className="text-right">{(log.stay_tasks_created ?? 0) + (log.checkout_tasks_created ?? 0)}<span className="ml-1 text-xs text-muted-foreground">canc {log.tasks_cancelled ?? 0}</span></TableCell>
                  <TableCell className="text-right">{(log.warnings?.length ?? 0) + (log.errors?.length ?? 0)}{log.blocks_detected ? <span className="ml-1 text-xs text-amber-700">bloq {log.blocks_detected}</span> : null}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
