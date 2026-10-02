import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  ArrowLeft,
  BedDouble,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock3,
  Hotel,
  History,
  Plus,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";

type ServiceKind = "checkout" | "stay";

interface LHReservation {
  id: string;
  external_id: string;
  check_in: string;
  check_out: string;
  room: string;
  rooms: string[] | null;
  needs_room_assignment: boolean | null;
  guest_name: string | null;
  status: string;
  synced_at: string | null;
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
  created_at: string;
  result: {
    reservation_created?: boolean;
    cancelled?: boolean;
    rooms_processed?: string[];
  } | null;
}

interface LHReservationSummary {
  external_id: string;
  check_in: string;
  check_out: string;
  room: string;
  rooms: string[] | null;
}

interface SyncReservationDetail {
  externalId: string;
  room: string;
  checkIn: string;
  checkOut: string;
}

const RESERVATIONS_PER_PAGE = 25;
const HISTORY_PER_PAGE = 8;
const MAX_HISTORY_LOGS = 1000;
const SYNC_IDLE_GAP_MS = 10 * 60 * 1000;

function reservationStatus(status: string) {
  switch (status.toLowerCase()) {
    case "confirmed":
      return { label: "Confirmada", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
    case "cancelled":
    case "canceled":
      return { label: "Cancelada", className: "border-rose-200 bg-rose-50 text-rose-700" };
    case "no_show":
      return { label: "No presentada", className: "border-slate-200 bg-slate-100 text-slate-700" };
    default:
      return { label: "Pendiente", className: "border-amber-200 bg-amber-50 text-amber-800" };
  }
}

function formatLHDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Madrid",
  }).format(date);
}

function reservationNights(checkIn: string, checkOut: string) {
  const start = Date.parse(`${checkIn.slice(0, 10)}T00:00:00Z`);
  const end = Date.parse(`${checkOut.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.round((end - start) / 86_400_000);
}

function searchSafeTerm(value: string) {
  return value.trim().replace(/[(),%\\"']/g, "").replace(/\s+/g, " ").slice(0, 80);
}

interface SyncHistoryEntry {
  id: string;
  startedAt: string;
  total: number;
  failed: number;
  newReservations: SyncReservationDetail[];
  cancelledReservations: SyncReservationDetail[];
}

function groupSyncHistory(logs: LHSyncLog[], reservations: LHReservationSummary[]): SyncHistoryEntry[] {
  const reservationByExternalId = new Map(reservations.map((reservation) => [reservation.external_id, reservation]));
  const chronological = [...logs].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const groups: Array<SyncHistoryEntry & {
    lastAt: number;
    newReservationKeys: Set<string>;
    cancelledReservationKeys: Set<string>;
  }> = [];

  for (const log of chronological) {
    const timestamp = new Date(log.created_at).getTime();
    if (!Number.isFinite(timestamp)) continue;
    let group = groups[groups.length - 1];
    if (!group || timestamp - group.lastAt > SYNC_IDLE_GAP_MS) {
      group = {
        id: log.id,
        startedAt: log.created_at,
        lastAt: timestamp,
        total: 0,
        failed: 0,
        newReservations: [],
        cancelledReservations: [],
        newReservationKeys: new Set(),
        cancelledReservationKeys: new Set(),
      };
      groups.push(group);
    }
    group.lastAt = timestamp;
    group.total += 1;
    if (!log.success || (log.status_code ?? 200) >= 400 || log.error_message) group.failed += 1;

    const externalId = log.external_id;
    const loggedReservation = log.result;
    if (!externalId || !loggedReservation || (!loggedReservation.reservation_created && !loggedReservation.cancelled)) continue;
    const reservation = reservationByExternalId.get(externalId);
    if (!reservation) continue;
    const rooms = loggedReservation.rooms_processed?.length
      ? loggedReservation.rooms_processed
      : reservation.rooms?.length
        ? reservation.rooms
        : [reservation.room];
    const details = rooms.map((room) => ({
      externalId,
      room,
      checkIn: reservation.check_in,
      checkOut: reservation.check_out,
    }));
    if (loggedReservation.cancelled) {
      for (const detail of details) {
        const key = JSON.stringify([detail.externalId, detail.room]);
        if (group.cancelledReservationKeys.has(key)) continue;
        group.cancelledReservationKeys.add(key);
        group.cancelledReservations.push(detail);
      }
    } else if (loggedReservation.reservation_created) {
      for (const detail of details) {
        const key = JSON.stringify([detail.externalId, detail.room]);
        if (group.newReservationKeys.has(key)) continue;
        group.newReservationKeys.add(key);
        group.newReservations.push(detail);
      }
    }
  }

  return groups.reverse().map(({
    lastAt: _lastAt,
    newReservationKeys: _newReservationKeys,
    cancelledReservationKeys: _cancelledReservationKeys,
    ...entry
  }) => entry);
}

export default function LittleHotelierAdmin() {
  const navigate = useNavigate();
  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-4 py-5 sm:px-6 sm:py-8">
      <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="mt-0.5 shrink-0 rounded-full"
            aria-label="Volver al inicio"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Hotel className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Integraciones</p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight sm:text-3xl">
              Little Hotelier
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Reservas, habitaciones y actividad reciente
            </p>
          </div>
        </div>
      </header>

      <Tabs defaultValue="reservations" className="space-y-5">
        <TabsList className="grid h-auto w-full max-w-2xl grid-cols-3 rounded-xl bg-muted/70 p-1">
          <TabsTrigger value="reservations" className="gap-2 rounded-lg py-2.5">
            <CalendarDays className="hidden h-4 w-4 sm:block" /> Reservas
          </TabsTrigger>
          <TabsTrigger value="mappings" className="gap-2 rounded-lg py-2.5">
            <BedDouble className="hidden h-4 w-4 sm:block" /> Habitaciones
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2 rounded-lg py-2.5">
            <History className="hidden h-4 w-4 sm:block" /> Historial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reservations" className="mt-0 focus-visible:outline-none">
          <ReservationsTab />
        </TabsContent>
        <TabsContent value="mappings" className="mt-0 focus-visible:outline-none">
          <MappingsTab />
        </TabsContent>
        <TabsContent value="logs" className="mt-0 focus-visible:outline-none">
          <LogsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============ RESERVATIONS TAB ============
function ReservationsTab() {
  const [search, setSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearchTerm(searchSafeTerm(search)), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const { data, isLoading, isError, error, isFetching, refetch } = useQuery({
    queryKey: ["lh-reservations", page, statusFilter, searchTerm],
    queryFn: async () => {
      let request = (supabase
        .from("lh_reservations" as any)
        .select(
          "id, external_id, check_in, check_out, room, rooms, needs_room_assignment, guest_name, status, synced_at",
          { count: "exact" },
        ) as any);
      if (statusFilter === "cancelled") {
        request = request.in("status", ["cancelled", "canceled"]);
      } else if (statusFilter !== "all") {
        request = request.eq("status", statusFilter);
      }
      if (searchTerm) {
        request = request.or(
          `guest_name.ilike.%${searchTerm}%,room.ilike.%${searchTerm}%,external_id.ilike.%${searchTerm}%`,
        );
      }
      const start = page * RESERVATIONS_PER_PAGE;
      const { data, error, count } = await request
        .order("check_in", { ascending: false })
        .order("id", { ascending: true })
        .range(start, start + RESERVATIONS_PER_PAGE - 1);
      if (error) throw error;
      return {
        rows: (data ?? []) as LHReservation[],
        total: count ?? 0,
      };
    },
    staleTime: 30_000,
  });
  const reservations = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / RESERVATIONS_PER_PAGE);
  const firstRow = total ? page * RESERVATIONS_PER_PAGE + 1 : 0;
  const lastRow = Math.min((page + 1) * RESERVATIONS_PER_PAGE, total);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Reservas sincronizadas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Consulta las estancias recibidas desde Little Hotelier.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-fit gap-2"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      <Card className="overflow-hidden rounded-2xl border-border/70 shadow-sm">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Buscar por huésped o habitación"
                placeholder="Buscar huésped o habitación"
                className="h-10 rounded-xl pl-9"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(0);
                }}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                setPage(0);
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-xl sm:w-48" aria-label="Filtrar por estado">
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="confirmed">Confirmadas</SelectItem>
                <SelectItem value="cancelled">Canceladas</SelectItem>
                <SelectItem value="no_show">No presentadas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isError ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-10 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <div>
                <p className="font-medium">No se pudieron cargar las reservas</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {error instanceof Error ? error.message : "Comprueba la conexión y vuelve a intentarlo."}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                Volver a intentar
              </Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-3 py-3" aria-label="Cargando reservas">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="h-[68px] animate-pulse rounded-xl bg-muted/70" />
              ))}
            </div>
          ) : reservations.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed px-4 py-12 text-center">
              <CalendarDays className="h-9 w-9 text-muted-foreground/60" />
              <p className="mt-3 font-medium">
                {searchTerm || statusFilter !== "all" ? "No hay resultados con estos filtros" : "Todavía no hay reservas"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchTerm || statusFilter !== "all" ? "Prueba a cambiar la búsqueda o el estado." : "Cuando se reciban reservas, aparecerán aquí."}
              </p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-xl border md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="pl-4">Reserva</TableHead>
                      <TableHead>Habitación</TableHead>
                      <TableHead>Entrada</TableHead>
                      <TableHead>Salida</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reservations.map((reservation) => {
                      const state = reservationStatus(reservation.status);
                      const rooms = reservation.rooms?.filter(Boolean) ?? [];
                      const nightCount = reservationNights(reservation.check_in, reservation.check_out);
                      return (
                        <TableRow key={reservation.id} className="transition-colors hover:bg-muted/30">
                          <TableCell className="max-w-[260px] pl-4">
                            <span className="block truncate font-medium">
                              {reservation.guest_name || "Huésped sin nombre"}
                            </span>
                            {nightCount !== null && (
                              <span className="text-xs text-muted-foreground">
                                {nightCount} {nightCount === 1 ? "noche" : "noches"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {reservation.needs_room_assignment ? (
                              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                                Sin habitación asignada
                              </Badge>
                            ) : rooms.length ? (
                              <div className="flex flex-wrap gap-1.5">
                                {rooms.map((room) => <Badge key={room} variant="secondary" className="font-normal">{room}</Badge>)}
                              </div>
                            ) : <span className="text-muted-foreground">{reservation.room || "—"}</span>}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{formatLHDate(reservation.check_in)}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatLHDate(reservation.check_out)}</TableCell>
                          <TableCell><Badge variant="outline" className={state.className}>{state.label}</Badge></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-3 md:hidden">
                {reservations.map((reservation) => {
                  const state = reservationStatus(reservation.status);
                  const rooms = reservation.rooms?.filter(Boolean) ?? [];
                  const nightCount = reservationNights(reservation.check_in, reservation.check_out);
                  return (
                    <article key={reservation.id} className="rounded-xl border p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{reservation.guest_name || "Huésped sin nombre"}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {reservation.needs_room_assignment ? "Sin habitación asignada" : rooms.join(", ") || reservation.room || "Habitación pendiente"}
                          </p>
                        </div>
                        <Badge variant="outline" className={`shrink-0 ${state.className}`}>{state.label}</Badge>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-3 text-sm">
                        <div><span className="block text-xs text-muted-foreground">Entrada</span>{formatLHDate(reservation.check_in)}</div>
                        <div><span className="block text-xs text-muted-foreground">Salida</span>{formatLHDate(reservation.check_out)}</div>
                      </div>
                      {nightCount !== null && <p className="mt-2 text-xs text-muted-foreground">{nightCount} {nightCount === 1 ? "noche" : "noches"}</p>}
                    </article>
                  );
                })}
              </div>

              <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {total ? `Mostrando ${firstRow}–${lastRow} de ${total} reservas` : "Sin reservas"}
                </p>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 rounded-lg"
                    onClick={() => setPage((current) => Math.max(0, current - 1))}
                    disabled={page === 0 || isFetching}
                  >
                    <ChevronLeft className="h-4 w-4" /> Anterior
                  </Button>
                  <span className="min-w-[94px] text-center text-sm text-muted-foreground">
                    Página {page + 1} de {Math.max(1, totalPages)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 rounded-lg"
                    onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
                    disabled={page >= totalPages - 1 || isFetching}
                  >
                    Siguiente <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
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
        .select("rooms");
      const rooms = new Set<string>();
      (data ?? []).forEach((r: any) => {
        (r.rooms ?? []).forEach((name: string) => {
          if (name && name.trim() && name !== "-") rooms.add(name.trim());
        });
      });
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
    (mappings ?? [])
      .filter((mapping) => mapping.is_active)
      .map((mapping) => `${mapping.lh_room}|${mapping.service_kind}`),
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

  const mappingGroups = useMemo(() => {
    const groups = new Map<string, LHRoomMapping[]>();
    (mappings ?? []).forEach((mapping) => {
      const current = groups.get(mapping.lh_room) ?? [];
      current.push(mapping);
      groups.set(mapping.lh_room, current);
    });
    return Array.from(groups.entries()).map(([room, roomMappings]) => ({
      room,
      mappings: roomMappings,
    }));
  }, [mappings]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Mapeo de habitaciones</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada habitación mantiene su vínculo con la propiedad y el servicio correspondiente.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {(mappings ?? []).length} {((mappings ?? []).length === 1) ? "mapeo" : "mapeos"}
          </span>
          <Button className="rounded-xl" onClick={() => openNew()}>
            <Plus className="mr-2 h-4 w-4" /> Añadir habitación
          </Button>
        </div>
      </div>

      {missing.length > 0 && (
        <Card className="rounded-2xl border-amber-200 bg-amber-50/70 shadow-none">
          <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-3">
            <div className="mt-0.5 rounded-lg bg-amber-100 p-2 text-amber-800">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base text-amber-950">Hay habitaciones pendientes de mapear</CardTitle>
              <CardDescription className="mt-1 text-amber-900/80">
                Completa estos vínculos para que puedan generarse sus tareas.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {missing.map((m) => (
              <div
                key={m.room}
                className="flex flex-col gap-3 rounded-xl border border-amber-200/80 bg-white/70 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <span className="font-medium">{m.room}</span>{" "}
                  <span className="text-sm text-amber-900/80">
                    Falta {m.missingKinds.map((kind) => kind === "checkout" ? "salida" : "estancia diaria").join(" y ").toLowerCase()}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {m.missingKinds.map((k) => (
                    <Button
                      key={k}
                      size="sm"
                      variant="outline"
                      className="rounded-lg border-amber-300 bg-white"
                      onClick={() =>
                        openNew({ lh_room: m.room, service_kind: k })
                      }
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      {k === "checkout" ? "Mapear salida" : "Mapear estancia"}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {mappingGroups.length === 0 ? (
        <Card className="rounded-2xl border-dashed shadow-none">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <BedDouble className="h-9 w-9 text-muted-foreground/60" />
            <p className="mt-3 font-medium">Aún no hay habitaciones vinculadas</p>
            <p className="mt-1 text-sm text-muted-foreground">Añade un mapeo para relacionar una habitación con su propiedad.</p>
            <Button className="mt-4 rounded-xl" variant="outline" onClick={() => openNew()}>
              <Plus className="mr-2 h-4 w-4" /> Añadir habitación
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {mappingGroups.map((group) => (
            <Card key={group.room} className="overflow-hidden rounded-2xl border-border/70 shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 border-b bg-muted/20 px-4 py-3.5 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <BedDouble className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{group.room}</CardTitle>
                    <CardDescription className="mt-0.5">
                      {group.mappings.length} {group.mappings.length === 1 ? "servicio vinculado" : "servicios vinculados"}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="divide-y p-0">
                {group.mappings.map((mapping) => {
                  const property = (properties ?? []).find((item) => item.id === mapping.propiedad_id);
                  return (
                    <div key={mapping.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={mapping.service_kind === "checkout" ? "default" : "secondary"}>
                            {mapping.service_kind === "checkout" ? "Limpieza de salida" : "Limpieza durante estancia"}
                          </Badge>
                          <Badge variant="outline" className={mapping.is_active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-600"}>
                            {mapping.is_active ? "Activa" : "Pausada"}
                          </Badge>
                        </div>
                        <p className="truncate text-sm font-medium">{property?.nombre ?? "Propiedad no disponible"}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> {mapping.default_start_time} · {mapping.default_duration_min} min</span>
                          <span>{Number(mapping.default_cost ?? 0).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="rounded-lg"
                          aria-label={`Editar mapeo ${group.room}`}
                          onClick={() => {
                            setEditing(mapping);
                            setOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="rounded-lg text-muted-foreground hover:text-destructive"
                          aria-label={`Eliminar mapeo ${group.room}`}
                          onClick={() => {
                            if (confirm("¿Eliminar este mapeo?")) deleteMutation.mutate(mapping.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
  const [page, setPage] = useState(0);
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(() => new Set());
  const { data, isLoading, isError, error, isFetching, refetch } = useQuery({
    queryKey: ["lh-sync-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lh_sync_logs" as any)
        .select("id, external_id, result, success, status_code, error_message, created_at")
        .order("created_at", { ascending: false })
        .limit(MAX_HISTORY_LOGS);
      if (error) throw error;
      const logs = (data ?? []) as unknown as LHSyncLog[];
      const externalIds = [...new Set(logs
        .filter((log) => log.result?.reservation_created || log.result?.cancelled)
        .map((log) => log.external_id)
        .filter((externalId): externalId is string => Boolean(externalId)))];
      if (externalIds.length === 0) return { logs, reservations: [] as LHReservationSummary[] };

      const { data: reservations, error: reservationsError } = await supabase
        // Little Hotelier's operational tables are not part of the generated Supabase types.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("lh_reservations" as any)
        .select("external_id, check_in, check_out, room, rooms")
        .in("external_id", externalIds);
      if (reservationsError) throw reservationsError;
      return {
        logs,
        reservations: (reservations ?? []) as unknown as LHReservationSummary[],
      };
    },
    staleTime: 30_000,
  });
  const history = useMemo(
    () => groupSyncHistory(data?.logs ?? [], data?.reservations ?? []),
    [data],
  );
  const totalPages = Math.ceil(history.length / HISTORY_PER_PAGE);
  const currentPage = Math.min(page, Math.max(0, totalPages - 1));
  const visibleHistory = history.slice(
    currentPage * HISTORY_PER_PAGE,
    currentPage * HISTORY_PER_PAGE + HISTORY_PER_PAGE,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Historial de sincronización</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Resumen de las pasadas más recientes.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-fit gap-2 rounded-lg"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      <Card className="overflow-hidden rounded-2xl border-border/70 shadow-sm">
        <CardContent className="p-4 sm:p-5">
          {isError ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-10 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <div>
                <p className="font-medium">No se pudo cargar el historial</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {error instanceof Error ? error.message : "Comprueba la conexión y vuelve a intentarlo."}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                Volver a intentar
              </Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-3 py-3" aria-label="Cargando historial">
              {[0, 1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-muted/70" />)}
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <History className="h-9 w-9 text-muted-foreground/60" />
              <p className="mt-3 font-medium">Todavía no hay sincronizaciones</p>
              <p className="mt-1 text-sm text-muted-foreground">Cuando se ejecute una pasada, aparecerá aquí.</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {visibleHistory.map((run) => {
                  const failed = run.failed > 0;
                  const date = new Date(run.startedAt);
                  const dateLabel = Number.isNaN(date.getTime())
                    ? "Fecha no disponible"
                    : new Intl.DateTimeFormat("es-ES", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        timeZone: "Europe/Madrid",
                      }).format(date);
                  const timeLabel = Number.isNaN(date.getTime())
                    ? ""
                    : new Intl.DateTimeFormat("es-ES", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Europe/Madrid",
                      }).format(date);

                  const isExpanded = expandedRuns.has(run.id);
                  const toggleExpanded = () => setExpandedRuns((current) => {
                    const next = new Set(current);
                    if (next.has(run.id)) next.delete(run.id);
                    else next.add(run.id);
                    return next;
                  });
                  const reservationCount = run.newReservations.length + run.cancelledReservations.length;

                  return (
                    <article key={run.id} className="overflow-hidden rounded-xl border transition-colors hover:bg-muted/20">
                      <button
                        type="button"
                        className="flex w-full flex-col gap-3 p-4 text-left sm:flex-row sm:items-center sm:justify-between"
                        onClick={toggleExpanded}
                        aria-expanded={isExpanded}
                        aria-label={`${dateLabel} ${timeLabel}, ${reservationCount} reservas nuevas o canceladas`}
                      >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${failed ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}`}>
                          {failed ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{dateLabel}</p>
                            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock3 className="h-3.5 w-3.5" /> {timeLabel}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {run.total} {run.total === 1 ? "reserva revisada" : "reservas revisadas"}
                            {run.failed > 0 ? ` · ${run.failed} con incidencia` : ""}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`w-fit shrink-0 ${failed ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
                      >
                        {failed ? "Revisar" : "Correcta"}
                      </Badge>
                      <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </button>
                      {isExpanded && (
                        <div className="space-y-4 border-t bg-muted/10 px-4 py-4 sm:px-6">
                          <ReservationDetailsSection
                            title="Reservas nuevas"
                            reservations={run.newReservations}
                            emptyMessage="No se añadieron reservas nuevas en esta sincronización."
                          />
                          <ReservationDetailsSection
                            title="Reservas canceladas"
                            reservations={run.cancelledReservations}
                            emptyMessage="No se cancelaron reservas en esta sincronización."
                          />
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {history.length} {history.length === 1 ? "sincronización reciente" : "sincronizaciones recientes"}
                </p>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 rounded-lg"
                    onClick={() => setPage((current) => Math.max(0, current - 1))}
                    disabled={currentPage === 0 || isFetching}
                  >
                    <ChevronLeft className="h-4 w-4" /> Anterior
                  </Button>
                  <span className="min-w-[94px] text-center text-sm text-muted-foreground">
                    Página {currentPage + 1} de {Math.max(1, totalPages)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 rounded-lg"
                    onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
                    disabled={currentPage >= totalPages - 1 || isFetching}
                  >
                    Siguiente <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReservationDetailsSection({
  title,
  reservations,
  emptyMessage,
}: {
  title: string;
  reservations: SyncReservationDetail[];
  emptyMessage: string;
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold">{title} <span className="font-normal text-muted-foreground">({reservations.length})</span></h3>
      {reservations.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="mt-2 divide-y rounded-lg border bg-background">
          {reservations.map((reservation, index) => (
            <li key={`${reservation.externalId}-${reservation.room}-${index}`} className="grid gap-2 px-3 py-2.5 text-sm sm:grid-cols-3 sm:gap-4">
              <span className="flex items-center gap-2 font-medium"><BedDouble className="h-4 w-4 text-muted-foreground" />{reservation.room}</span>
              <span className="text-muted-foreground">Entrada: <span className="text-foreground">{formatLHDate(reservation.checkIn)}</span></span>
              <span className="text-muted-foreground">Salida: <span className="text-foreground">{formatLHDate(reservation.checkOut)}</span></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
