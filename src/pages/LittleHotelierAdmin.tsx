import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Hotel, Plus, Pencil, Trash2 } from "lucide-react";

type ServiceKind = "checkout" | "stay";

interface LHReservation {
  id: string;
  external_id: string;
  reference: string | null;
  channel: string | null;
  check_in: string;
  check_out: string;
  room: string;
  guest_name: string | null;
  adults: number | null;
  children: number | null;
  infants: number | null;
  status: string;
  total: string | null;
  sede_id: string | null;
  synced_at: string | null;
  created_at: string;
}

interface LHRoomMapping {
  id: string;
  sede_id: string;
  lh_room: string;
  service_kind: ServiceKind;
  cliente_id: string;
  propiedad_id: string;
  task_type: string;
  default_start_time: string;
  default_duration_min: number;
  default_cost: number;
  is_active: boolean;
}

interface LHSyncLog {
  id: string;
  external_id: string | null;
  status_code: number | null;
  success: boolean;
  error_message: string | null;
  result: any;
  created_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  confirmed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  canceled: "bg-red-100 text-red-800",
  no_show: "bg-gray-100 text-gray-800",
};

export default function LittleHotelierAdmin() {
  const navigate = useNavigate();
  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver
        </Button>
        <Hotel className="h-6 w-6 text-amber-600" />
        <h1 className="text-2xl font-bold">Little Hotelier</h1>
      </div>

      <Tabs defaultValue="reservations">
        <TabsList>
          <TabsTrigger value="reservations">Reservas</TabsTrigger>
          <TabsTrigger value="mappings">Mapeo de habitaciones</TabsTrigger>
          <TabsTrigger value="logs">Logs de sincronización</TabsTrigger>
        </TabsList>

        <TabsContent value="reservations" className="mt-4">
          <ReservationsTab />
        </TabsContent>
        <TabsContent value="mappings" className="mt-4">
          <MappingsTab />
        </TabsContent>
        <TabsContent value="logs" className="mt-4">
          <LogsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============ RESERVATIONS TAB ============
function ReservationsTab() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["lh-reservations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lh_reservations" as any)
        .select("*")
        .order("check_in", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as LHReservation[];
    },
  });

  const filtered = useMemo(() => {
    const list = data ?? [];
    return list.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        (r.guest_name ?? "").toLowerCase().includes(s) ||
        (r.reference ?? "").toLowerCase().includes(s) ||
        r.room.toLowerCase().includes(s) ||
        r.external_id.toLowerCase().includes(s)
      );
    });
  }, [data, search, statusFilter]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reservas sincronizadas</CardTitle>
        <CardDescription>
          Últimas 500 reservas recibidas desde Little Hotelier
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs">Buscar</Label>
            <Input
              placeholder="Huésped, referencia, habitación..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Estado</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="confirmed">Confirmadas</SelectItem>
                <SelectItem value="cancelled">Canceladas</SelectItem>
                <SelectItem value="no_show">No show</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Cargando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground">Sin reservas.</p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estado</TableHead>
                  <TableHead>Huésped</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Habitación</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Salida</TableHead>
                  <TableHead className="text-right">Noches</TableHead>
                  <TableHead>Huéspedes</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const nights = Math.max(
                    0,
                    Math.round(
                      (new Date(r.check_out).getTime() -
                        new Date(r.check_in).getTime()) /
                        86400000,
                    ),
                  );
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Badge className={STATUS_BADGE[r.status] ?? ""}>
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {r.guest_name ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.reference ?? r.external_id}
                      </TableCell>
                      <TableCell>{r.channel ?? "—"}</TableCell>
                      <TableCell>{r.room}</TableCell>
                      <TableCell>{r.check_in}</TableCell>
                      <TableCell>{r.check_out}</TableCell>
                      <TableCell className="text-right">{nights}</TableCell>
                      <TableCell className="text-xs">
                        {r.adults ?? 0}A
                        {(r.children ?? 0) > 0 ? ` · ${r.children}N` : ""}
                        {(r.infants ?? 0) > 0 ? ` · ${r.infants}B` : ""}
                      </TableCell>
                      <TableCell>{r.total ?? "—"}</TableCell>
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

// ============ MAPPINGS TAB ============
function MappingsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<LHRoomMapping> | null>(null);
  const [open, setOpen] = useState(false);

  const { data: mappings } = useQuery({
    queryKey: ["lh-mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lh_room_mapping" as any)
        .select("*")
        .order("lh_room")
        .order("service_kind");
      if (error) throw error;
      return (data ?? []) as unknown as LHRoomMapping[];
    },
  });

  const { data: sedes } = useQuery({
    queryKey: ["sedes-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sedes")
        .select("id, nombre")
        .eq("is_active", true)
        .order("nombre");
      return data ?? [];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, nombre")
        .order("nombre");
      return data ?? [];
    },
  });

  const { data: properties } = useQuery({
    queryKey: ["properties-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("properties")
        .select("id, nombre, cliente_id, sede_id")
        .order("nombre");
      return data ?? [];
    },
  });

  const { data: detectedRooms } = useQuery({
    queryKey: ["lh-detected-rooms"],
    queryFn: async () => {
      const { data } = await supabase
        .from("lh_reservations" as any)
        .select("room");
      const rooms = new Set<string>();
      (data ?? []).forEach((r: any) => rooms.add(r.room));
      return Array.from(rooms).sort();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (m: Partial<LHRoomMapping>) => {
      const payload = {
        sede_id: m.sede_id,
        lh_room: m.lh_room,
        service_kind: m.service_kind,
        cliente_id: m.cliente_id,
        propiedad_id: m.propiedad_id,
        task_type: m.task_type || "limpieza-turistica",
        default_start_time: m.default_start_time || "11:00",
        default_duration_min: m.default_duration_min ?? 60,
        default_cost: m.default_cost ?? 0,
        is_active: m.is_active ?? true,
      };
      if (m.id) {
        const { error } = await supabase
          .from("lh_room_mapping" as any)
          .update(payload)
          .eq("id", m.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("lh_room_mapping" as any)
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Mapeo guardado" });
      qc.invalidateQueries({ queryKey: ["lh-mappings"] });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("lh_room_mapping" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Mapeo eliminado" });
      qc.invalidateQueries({ queryKey: ["lh-mappings"] });
    },
  });

  // Rooms seen in reservations but without both checkout+stay mappings
  const mappedKeys = new Set(
    (mappings ?? []).map((m) => `${m.lh_room}|${m.service_kind}`),
  );
  const missing: Array<{ room: string; missingKinds: ServiceKind[] }> = [];
  (detectedRooms ?? []).forEach((room) => {
    const miss: ServiceKind[] = [];
    if (!mappedKeys.has(`${room}|checkout`)) miss.push("checkout");
    if (!mappedKeys.has(`${room}|stay`)) miss.push("stay");
    if (miss.length > 0) missing.push({ room, missingKinds: miss });
  });

  const openNew = (prefill?: Partial<LHRoomMapping>) => {
    setEditing({
      service_kind: "checkout",
      task_type: "limpieza-turistica",
      default_start_time: "11:00",
      default_duration_min: 60,
      default_cost: 0,
      is_active: true,
      ...prefill,
    });
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      {missing.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-900">
              Habitaciones sin mapear completamente
            </CardTitle>
            <CardDescription className="text-amber-900">
              Estas habitaciones aparecen en reservas pero faltan mapeos. Sin
              mapeo, no se generan tareas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {missing.map((m) => (
              <div
                key={m.room}
                className="flex items-center justify-between border-b border-amber-200 pb-2"
              >
                <div>
                  <span className="font-medium">{m.room}</span>{" "}
                  <span className="text-xs text-amber-800">
                    Falta: {m.missingKinds.join(", ")}
                  </span>
                </div>
                <div className="flex gap-2">
                  {m.missingKinds.map((k) => (
                    <Button
                      key={k}
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        openNew({ lh_room: m.room, service_kind: k })
                      }
                    >
                      <Plus className="h-3 w-3 mr-1" /> {k}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Mapeo de habitaciones</CardTitle>
            <CardDescription>
              Cada habitación de Little Hotelier vinculada a una propiedad y
              tipo de servicio (salida o estancia diaria)
            </CardDescription>
          </div>
          <Button onClick={() => openNew()}>
            <Plus className="h-4 w-4 mr-1" /> Nuevo mapeo
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Habitación LH</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Propiedad</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead className="text-right">Duración</TableHead>
                  <TableHead className="text-right">Coste</TableHead>
                  <TableHead>Activo</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(mappings ?? []).map((m) => {
                  const prop = (properties ?? []).find(
                    (p) => p.id === m.propiedad_id,
                  );
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.lh_room}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            m.service_kind === "checkout" ? "default" : "secondary"
                          }
                        >
                          {m.service_kind === "checkout"
                            ? "Salida"
                            : "Estancia"}
                        </Badge>
                      </TableCell>
                      <TableCell>{prop?.nombre ?? m.propiedad_id}</TableCell>
                      <TableCell>{m.default_start_time}</TableCell>
                      <TableCell className="text-right">
                        {m.default_duration_min} min
                      </TableCell>
                      <TableCell className="text-right">
                        {m.default_cost} €
                      </TableCell>
                      <TableCell>{m.is_active ? "Sí" : "No"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditing(m);
                            setOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm("¿Eliminar este mapeo?"))
                              deleteMutation.mutate(m.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setEditing(null);
        }}
        editing={editing}
        setEditing={setEditing}
        sedes={sedes ?? []}
        clients={clients ?? []}
        properties={properties ?? []}
        onSave={(m) => saveMutation.mutate(m)}
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
  onOpenChange: (o: boolean) => void;
  editing: Partial<LHRoomMapping> | null;
  setEditing: (m: Partial<LHRoomMapping> | null) => void;
  sedes: Array<{ id: string; nombre: string }>;
  clients: Array<{ id: string; nombre: string }>;
  properties: Array<{ id: string; nombre: string; cliente_id: string; sede_id: string }>;
  onSave: (m: Partial<LHRoomMapping>) => void;
  saving: boolean;
}) {
  if (!editing) return null;
  const filteredProps = editing.cliente_id
    ? properties.filter((p) => p.cliente_id === editing.cliente_id)
    : properties;

  const update = (patch: Partial<LHRoomMapping>) =>
    setEditing({ ...editing, ...patch });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing.id ? "Editar mapeo" : "Nuevo mapeo"}
          </DialogTitle>
          <DialogDescription>
            Vincula una habitación de Little Hotelier con una propiedad y tipo
            de servicio.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Habitación LH (texto exacto)</Label>
            <Input
              value={editing.lh_room ?? ""}
              onChange={(e) => update({ lh_room: e.target.value })}
              placeholder="Habitación 2"
            />
          </div>
          <div>
            <Label>Tipo de servicio</Label>
            <Select
              value={editing.service_kind}
              onValueChange={(v: ServiceKind) => update({ service_kind: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="checkout">Salida (checkout)</SelectItem>
                <SelectItem value="stay">Estancia diaria</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Sede</Label>
            <Select
              value={editing.sede_id}
              onValueChange={(v) => update({ sede_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                {sedes.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Cliente</Label>
            <Select
              value={editing.cliente_id}
              onValueChange={(v) =>
                update({ cliente_id: v, propiedad_id: undefined })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Propiedad</Label>
            <Select
              value={editing.propiedad_id}
              onValueChange={(v) => {
                const p = properties.find((x) => x.id === v);
                update({
                  propiedad_id: v,
                  sede_id: p?.sede_id ?? editing.sede_id,
                  cliente_id: p?.cliente_id ?? editing.cliente_id,
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                {filteredProps.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo de tarea</Label>
            <Input
              value={editing.task_type ?? "limpieza-turistica"}
              onChange={(e) => update({ task_type: e.target.value })}
            />
          </div>
          <div>
            <Label>Hora inicio</Label>
            <Input
              type="time"
              value={editing.default_start_time ?? "11:00"}
              onChange={(e) => update({ default_start_time: e.target.value })}
            />
          </div>
          <div>
            <Label>Duración (min, múltiplos de 15)</Label>
            <Input
              type="number"
              min={15}
              step={15}
              value={editing.default_duration_min ?? 60}
              onChange={(e) =>
                update({ default_duration_min: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <Label>Coste (€)</Label>
            <Input
              type="number"
              step={0.01}
              value={editing.default_cost ?? 0}
              onChange={(e) =>
                update({ default_cost: Number(e.target.value) })
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={
              saving ||
              !editing.lh_room ||
              !editing.service_kind ||
              !editing.sede_id ||
              !editing.cliente_id ||
              !editing.propiedad_id
            }
            onClick={() => onSave(editing)}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ LOGS TAB ============
function LogsTab() {
  const { data } = useQuery({
    queryKey: ["lh-sync-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lh_sync_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as LHSyncLog[];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Últimas 100 peticiones recibidas</CardTitle>
        <CardDescription>
          Útil para depurar el script Python. Cada petición es una reserva.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>External ID</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Resumen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs">
                    {new Date(l.created_at).toLocaleString("es-ES", {
                      timeZone: "Europe/Madrid",
                    })}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {l.external_id ?? "—"}
                  </TableCell>
                  <TableCell>
                    {l.success ? (
                      <Badge className="bg-green-100 text-green-800">OK</Badge>
                    ) : (
                      <Badge variant="destructive">Error</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {l.error_message ? (
                      <span className="text-red-600">{l.error_message}</span>
                    ) : l.result ? (
                      <code>
                        creadas: {l.result.tasks_created?.length ?? 0} ·
                        canceladas: {l.result.tasks_cancelled?.length ?? 0}
                        {l.result.warnings?.length
                          ? ` · ⚠ ${l.result.warnings.length}`
                          : ""}
                      </code>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
