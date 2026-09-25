import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Hotel,
  RefreshCw,
} from "lucide-react";

/**
 * Pantalla del canal Smoobu (cliente Coto Rivas S.L / Houmi Orzán).
 *
 * La lectura vive en el PC de coordinación (sesión de Smoobu en un navegador propio),
 * no en el servidor. Esta pantalla no llama a Smoobu: muestra lo que ya está en la
 * base de datos y, para la sincronización manual, deja una petición que el proceso
 * local recoge en su siguiente vuelta (menos de 2 minutos).
 */

// Las tablas del canal Smoobu todavía no están en los tipos autogenerados
// (src/integrations/supabase/types.ts), igual que pasó con las de Little Hotelier.
// Se consultan por un único ayudante para no repartir `as any` por toda la página.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dbSmoobu = supabase as any;
const PASADAS = ["08:00", "15:00", "19:00"];
const MESES_VENTANA = 3;
const HORAS_AVISO = 8;

interface SmoobuReservation {
  id: string;
  external_id: string;
  property_name: string | null;
  property_id: string | null;
  check_in: string | null;
  check_out: string | null;
  status: string;
  guest_name: string | null;
  synced_at: string | null;
}

interface SmoobuLink {
  id: string;
  reservation_id: string;
  task_id: string | null;
  task_date: string | null;
  service_kind: string;
  status: string;
}

interface SmoobuTask {
  id: string;
  property: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
  cleaner: string | null;
}

interface SmoobuRun {
  id: string;
  cuando: string;
  disparo: string;
  modo: string;
  reservas: number;
  altas: number;
  actualizaciones: number;
  sin_cambios: number;
  canceladas: number;
  errores: number;
  sin_mapear: number;
  duracion_ms: number | null;
  email_enviado: boolean;
  detalle: Array<{ reserva?: string; salida?: string; ok?: boolean; respuesta?: string }> | null;
}

interface SmoobuRequest {
  id: string;
  pedida_por_nombre: string | null;
  pedida_at: string;
  estado: string;
  completada_at: string | null;
}

interface SmoobuMapping {
  id: string;
  smoobu_property_name: string;
  smoobu_property_id: string | null;
  property_id: string;
  is_active: boolean;
  notes: string | null;
}

interface Propiedad {
  id: string;
  nombre: string;
  codigo: string | null;
}

function fechaCorta(valor: string | null): string {
  if (!valor) return "—";
  const d = new Date(valor.length <= 10 ? `${valor}T12:00:00` : valor);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function fechaHora(valor: string | null): string {
  if (!valor) return "—";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function haceCuanto(valor: string | null): string {
  if (!valor) return "nunca";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return "nunca";
  const minutos = Math.round((Date.now() - d.getTime()) / 60000);
  if (minutos < 1) return "hace un momento";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} día${dias === 1 ? "" : "s"}`;
}

function segundos(ms: number | null): string {
  if (!ms || ms <= 0) return "—";
  return `${Math.round(ms / 1000)} s`;
}

export default function SmoobuAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [propiedadNueva, setPropiedadNueva] = useState<string>("");
  const [nombreSmoobuNuevo, setNombreSmoobuNuevo] = useState<string>("");
  const [notasNuevas, setNotasNuevas] = useState<string>("");
  const [detalleAbierto, setDetalleAbierto] = useState<string | null>(null);

  const { data: reservas = [], isLoading: cargandoReservas } = useQuery({
    queryKey: ["smoobu-reservas"],
    queryFn: async () => {
      const { data, error } = await dbSmoobu
        .from("smoobu_reservations")
        .select("id, external_id, property_name, property_id, check_in, check_out, status, guest_name, synced_at")
        .order("check_out", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as SmoobuReservation[];
    },
    staleTime: 60_000,
  });

  const { data: vinculos = [] } = useQuery({
    queryKey: ["smoobu-vinculos"],
    queryFn: async () => {
      const { data, error } = await dbSmoobu
        .from("smoobu_reservation_tasks")
        .select("id, reservation_id, task_id, task_date, service_kind, status");
      if (error) throw error;
      return (data ?? []) as unknown as SmoobuLink[];
    },
    staleTime: 60_000,
  });

  const { data: tareas = [] } = useQuery({
    queryKey: ["smoobu-tareas-creadas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, property, date, start_time, end_time, status, cleaner")
        .in("id", (vinculos.map((v) => v.task_id).filter(Boolean) as string[]).length
          ? (vinculos.map((v) => v.task_id).filter(Boolean) as string[])
          : ["00000000-0000-0000-0000-000000000000"]);
      if (error) throw error;
      return (data ?? []) as unknown as SmoobuTask[];
    },
    enabled: vinculos.length > 0,
    staleTime: 60_000,
  });

  const { data: pasadas = [], isLoading: cargandoPasadas } = useQuery({
    queryKey: ["smoobu-pasadas"],
    queryFn: async () => {
      const { data, error } = await dbSmoobu
        .from("smoobu_sync_runs")
        .select("*")
        .order("cuando", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as SmoobuRun[];
    },
    staleTime: 30_000,
  });

  const { data: peticiones = [] } = useQuery({
    queryKey: ["smoobu-peticiones"],
    queryFn: async () => {
      const { data, error } = await dbSmoobu
        .from("smoobu_sync_requests")
        .select("id, pedida_por_nombre, pedida_at, estado, completada_at")
        .order("pedida_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as SmoobuRequest[];
    },
    staleTime: 15_000,
  });

  const { data: mapeos = [], isLoading: cargandoMapeos } = useQuery({
    queryKey: ["smoobu-mapeos"],
    queryFn: async () => {
      const { data, error } = await dbSmoobu
        .from("smoobu_property_mappings")
        .select("id, smoobu_property_name, smoobu_property_id, property_id, is_active, notes")
        .order("smoobu_property_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as SmoobuMapping[];
    },
    staleTime: 60_000,
  });

  const { data: propiedades = [] } = useQuery({
    queryKey: ["smoobu-propiedades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, nombre, codigo")
        .order("nombre", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Propiedad[];
    },
    staleTime: 5 * 60_000,
  });

  const pedirSincronizacion = useMutation({
    mutationFn: async () => {
      const { error } = await dbSmoobu.from("smoobu_sync_requests").insert({
        pedida_por: user?.id ?? null,
        pedida_por_nombre: user?.email ?? "usuario de la app",
        nota: "Petición desde la pantalla de Smoobu",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Sincronización pedida",
        description: "La pasada arranca en menos de 2 minutos y verás aquí el resultado.",
      });
      queryClient.invalidateQueries({ queryKey: ["smoobu-peticiones"] });
    },
    onError: (error: unknown) => {
      toast({
        title: "No se pudo pedir la sincronización",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      });
    },
  });

  const guardarMapeo = useMutation({
    mutationFn: async () => {
      const { error } = await dbSmoobu.from("smoobu_property_mappings").insert({
        smoobu_property_name: nombreSmoobuNuevo.trim(),
        property_id: propiedadNueva,
        notes: notasNuevas.trim() || null,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Mapeo guardado", description: "A partir de la próxima pasada esa reserva ya crea limpieza." });
      setNombreSmoobuNuevo("");
      setPropiedadNueva("");
      setNotasNuevas("");
      queryClient.invalidateQueries({ queryKey: ["smoobu-mapeos"] });
    },
    onError: (error: unknown) => {
      toast({
        title: "No se pudo guardar el mapeo",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      });
    },
  });

  const cambiarEstadoMapeo = useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => {
      const { error } = await dbSmoobu
        .from("smoobu_property_mappings")
        .update({ is_active: activo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["smoobu-mapeos"] });
    },
    onError: (error: unknown) => {
      toast({
        title: "No se pudo cambiar el mapeo",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      });
    },
  });

  const ultimaPasada = pasadas[0] ?? null;
  const peticionPendiente = peticiones.find((p) => p.estado === "pendiente") ?? null;
  const peticionEnCurso = peticiones.find((p) => p.estado === "en_curso") ?? null;

  const horasSinLeer = ultimaPasada
    ? (Date.now() - new Date(ultimaPasada.cuando).getTime()) / 3_600_000
    : Number.POSITIVE_INFINITY;

  const tareasPorId = useMemo(() => {
    const mapa = new Map<string, SmoobuTask>();
    for (const t of tareas) mapa.set(t.id, t);
    return mapa;
  }, [tareas]);

  const vinculoPorReserva = useMemo(() => {
    const mapa = new Map<string, SmoobuLink>();
    for (const v of vinculos) mapa.set(v.reservation_id, v);
    return mapa;
  }, [vinculos]);

  const nombresMapeados = useMemo(
    () => new Set(mapeos.filter((m) => m.is_active).map((m) => m.smoobu_property_name)),
    [mapeos],
  );

  const sinMapear = useMemo(
    () => reservas.filter((r) => r.property_name && !nombresMapeados.has(r.property_name)),
    [reservas, nombresMapeados],
  );

  const nombrePropiedad = (id: string | null) =>
    propiedades.find((p) => p.id === id)?.nombre ?? id ?? "—";

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/">
            <ArrowLeft className="mr-1 h-4 w-4" /> Volver
          </Link>
        </Button>
        <Hotel className="h-6 w-6 text-amber-600" />
        <h1 className="text-2xl font-bold">Smoobu</h1>
        <Badge variant="outline">Coto Rivas S.L · Houmi Orzán</Badge>
      </div>

      <Tabs defaultValue="estado" className="space-y-4">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="estado">Estado</TabsTrigger>
          <TabsTrigger value="reservas">Reservas</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
          <TabsTrigger value="mapeo">Mapeo</TabsTrigger>
          <TabsTrigger value="ajustes">Ajustes</TabsTrigger>
        </TabsList>

        {/* ---------- ESTADO ---------- */}
        <TabsContent value="estado" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Última lectura de Smoobu</CardDescription>
                <CardTitle className="flex items-center gap-2 text-lg">
                  {horasSinLeer > HORAS_AVISO ? (
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  )}
                  {ultimaPasada ? haceCuanto(ultimaPasada.cuando) : "sin datos"}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {ultimaPasada
                  ? `${fechaHora(ultimaPasada.cuando)} · ${ultimaPasada.disparo} · ${ultimaPasada.modo === "real" ? "modo real" : "simulación"}`
                  : "Todavía no se ha registrado ninguna pasada."}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Reservas en la ventana</CardDescription>
                <CardTitle className="text-lg">{reservas.length}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Próximos {MESES_VENTANA} meses · {vinculos.filter((v) => v.status === "active").length} con limpieza vinculada
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Última pasada</CardDescription>
                <CardTitle className="text-lg">
                  {ultimaPasada ? `${ultimaPasada.altas} altas` : "—"}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {ultimaPasada
                  ? `${ultimaPasada.actualizaciones} reprogramadas · ${ultimaPasada.canceladas} canceladas · ${segundos(ultimaPasada.duracion_ms)}`
                  : "Sin pasadas registradas."}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Errores</CardDescription>
                <CardTitle className="flex items-center gap-2 text-lg">
                  {ultimaPasada && ultimaPasada.errores > 0 ? (
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  )}
                  {ultimaPasada ? ultimaPasada.errores : "—"}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {ultimaPasada?.errores
                  ? "Revisa el detalle en la pestaña Historial."
                  : "Sin errores en la última pasada."}
              </CardContent>
            </Card>
          </div>

          {sinMapear.length > 0 && (
            <Card className="border-amber-300 bg-amber-50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-amber-700" />
                  Hay {sinMapear.length} reserva(s) de alojamientos sin mapear
                </CardTitle>
                <CardDescription>
                  Esas reservas no crean limpieza. Añade el mapeo en la pestaña Mapeo con el nombre exacto
                  que usa Smoobu.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm">
                {Array.from(new Set(sinMapear.map((r) => r.property_name))).join(" · ")}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sincronización</CardTitle>
              <CardDescription>
                Se ejecuta sola a las {PASADAS.join(", ")}. El botón deja una petición que el proceso del
                PC de coordinación recoge en menos de 2 minutos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => pedirSincronizacion.mutate()}
                  disabled={pedirSincronizacion.isPending || Boolean(peticionPendiente)}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${pedirSincronizacion.isPending ? "animate-spin" : ""}`} />
                  Sincronizar ahora
                </Button>
                {peticionPendiente && (
                  <Badge variant="secondary" className="gap-1">
                    <Clock className="h-3 w-3" /> pedida {haceCuanto(peticionPendiente.pedida_at)}
                  </Badge>
                )}
                {peticionEnCurso && <Badge variant="secondary">en curso</Badge>}
              </div>

              {peticiones.length > 0 && (
                <div className="rounded-md border text-sm">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pedida</TableHead>
                        <TableHead>Por</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Terminada</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {peticiones.slice(0, 5).map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{fechaHora(p.pedida_at)}</TableCell>
                          <TableCell>{p.pedida_por_nombre ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant={p.estado === "completada" ? "default" : p.estado === "error" ? "destructive" : "secondary"}>
                              {p.estado}
                            </Badge>
                          </TableCell>
                          <TableCell>{p.completada_at ? fechaHora(p.completada_at) : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- RESERVAS ---------- */}
        <TabsContent value="reservas">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reservas importadas de Smoobu</CardTitle>
              <CardDescription>
                Solo las de los próximos {MESES_VENTANA} meses. La limpieza se crea el día de salida, a la
                hora de check-out de cada propiedad.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {cargandoReservas ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Cargando reservas…</p>
              ) : reservas.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Todavía no hay reservas importadas.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Salida</TableHead>
                        <TableHead>Llegada</TableHead>
                        <TableHead>Alojamiento</TableHead>
                        <TableHead>Reserva</TableHead>
                        <TableHead>Limpieza</TableHead>
                        <TableHead>Leída</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reservas.map((r) => {
                        const vinculo = vinculoPorReserva.get(r.id);
                        const tarea = vinculo?.task_id ? tareasPorId.get(vinculo.task_id) : undefined;
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="whitespace-nowrap font-medium">{fechaCorta(r.check_out)}</TableCell>
                            <TableCell className="whitespace-nowrap">{fechaCorta(r.check_in)}</TableCell>
                            <TableCell>{r.property_name ?? "—"}</TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {r.external_id.replace("smoobu:", "")}
                            </TableCell>
                            <TableCell>
                              {tarea ? (
                                <div className="space-y-1">
                                  <Badge variant={tarea.status === "pending" ? "secondary" : "default"}>
                                    {tarea.status}
                                  </Badge>
                                  <div className="text-xs text-muted-foreground">
                                    {tarea.start_time?.slice(0, 5)}–{tarea.end_time?.slice(0, 5)} ·{" "}
                                    {tarea.cleaner ?? "sin asignar"}
                                  </div>
                                </div>
                              ) : vinculo ? (
                                <Badge variant="outline">{vinculo.status}</Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {haceCuanto(r.synced_at)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- HISTORIAL ---------- */}
        <TabsContent value="historial">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historial de sincronizaciones</CardTitle>
              <CardDescription>
                Cada pasada con lo que leyó, lo que creó y lo que falló. El correo de resumen solo se manda
                cuando hay cambios o errores.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {cargandoPasadas ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Cargando historial…</p>
              ) : pasadas.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Todavía no hay pasadas registradas.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cuándo</TableHead>
                        <TableHead>Disparo</TableHead>
                        <TableHead>Leídas</TableHead>
                        <TableHead>Altas</TableHead>
                        <TableHead>Reprog.</TableHead>
                        <TableHead>Cancel.</TableHead>
                        <TableHead>Errores</TableHead>
                        <TableHead>Duración</TableHead>
                        <TableHead>Correo</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pasadas.map((p) => (
                        <>
                          <TableRow key={p.id}>
                            <TableCell className="whitespace-nowrap">{fechaHora(p.cuando)}</TableCell>
                            <TableCell>
                              <Badge variant={p.disparo === "manual" ? "secondary" : "outline"}>{p.disparo}</Badge>
                            </TableCell>
                            <TableCell>{p.reservas}</TableCell>
                            <TableCell>{p.altas}</TableCell>
                            <TableCell>{p.actualizaciones}</TableCell>
                            <TableCell>{p.canceladas}</TableCell>
                            <TableCell>
                              {p.errores > 0 ? (
                                <Badge variant="destructive">{p.errores}</Badge>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">{segundos(p.duracion_ms)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {p.email_enviado ? "enviado" : "no hacía falta"}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDetalleAbierto(detalleAbierto === p.id ? null : p.id)}
                              >
                                {detalleAbierto === p.id ? "Ocultar" : "Detalle"}
                              </Button>
                            </TableCell>
                          </TableRow>
                          {detalleAbierto === p.id && (
                            <TableRow key={`${p.id}-detalle`}>
                              <TableCell colSpan={10}>
                                <div className="max-h-72 overflow-y-auto rounded-md bg-muted p-3 text-xs">
                                  {(p.detalle ?? []).length === 0 ? (
                                    <p>Sin detalle por reserva.</p>
                                  ) : (
                                    (p.detalle ?? []).map((d, i) => (
                                      <div key={`${p.id}-${i}`} className="whitespace-pre-wrap break-words">
                                        [{d.ok ? "OK" : "ERR"}] {d.salida ?? "?"} · {d.reserva ?? "?"} · {d.respuesta ?? ""}
                                      </div>
                                    ))
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- MAPEO ---------- */}
        <TabsContent value="mapeo" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Relación Smoobu → Limpatex</CardTitle>
              <CardDescription>
                El nombre debe ser el exacto de Smoobu. El identificador estable lo rellena la sincronización
                y sirve para no depender del nombre.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {cargandoMapeos ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Cargando mapeos…</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Alojamiento en Smoobu</TableHead>
                        <TableHead>Id Smoobu</TableHead>
                        <TableHead>Propiedad</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mapeos.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>{m.smoobu_property_name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{m.smoobu_property_id ?? "—"}</TableCell>
                          <TableCell>{nombrePropiedad(m.property_id)}</TableCell>
                          <TableCell>
                            <Badge variant={m.is_active ? "default" : "secondary"}>
                              {m.is_active ? "activo" : "pausado"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={cambiarEstadoMapeo.isPending}
                              onClick={() => cambiarEstadoMapeo.mutate({ id: m.id, activo: !m.is_active })}
                            >
                              {m.is_active ? "Pausar" : "Reactivar"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-3">
                <div className="sm:col-span-1">
                  <Label htmlFor="smoobu-nombre">Nombre exacto en Smoobu</Label>
                  <Input
                    id="smoobu-nombre"
                    value={nombreSmoobuNuevo}
                    onChange={(e) => setNombreSmoobuNuevo(e.target.value)}
                    placeholder="Houmi Orzán - Apartamento 3 ..."
                  />
                </div>
                <div className="sm:col-span-1">
                  <Label>Propiedad Limpatex</Label>
                  <Select value={propiedadNueva} onValueChange={setPropiedadNueva}>
                    <SelectTrigger>
                      <SelectValue placeholder="Elige propiedad" />
                    </SelectTrigger>
                    <SelectContent>
                      {propiedades.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.codigo ? `${p.codigo} - ${p.nombre}` : p.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-1">
                  <Label htmlFor="smoobu-notas">Notas (opcional)</Label>
                  <Input
                    id="smoobu-notas"
                    value={notasNuevas}
                    onChange={(e) => setNotasNuevas(e.target.value)}
                    placeholder="Por qué se mapea así"
                  />
                </div>
                <div className="sm:col-span-3">
                  <Button
                    onClick={() => guardarMapeo.mutate()}
                    disabled={guardarMapeo.isPending || !nombreSmoobuNuevo.trim() || !propiedadNueva}
                  >
                    Añadir mapeo
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- AJUSTES ---------- */}
        <TabsContent value="ajustes">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cómo está configurado el canal</CardTitle>
              <CardDescription>Estos valores los fija la sincronización, no se editan desde aquí.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="font-medium">Ventana de importación:</span> próximos {MESES_VENTANA} meses.
              </p>
              <p>
                <span className="font-medium">Pasadas automáticas:</span> {PASADAS.join(", ")} (hora de Madrid).
              </p>
              <p>
                <span className="font-medium">Vigilancia previa:</span> una hora antes de cada pasada se comprueba
                la sesión, para tener margen si hay que arreglar algo.
              </p>
              <p>
                <span className="font-medium">Resumen por correo:</span> solo cuando hay cambios o errores; si hay
                errores, el asunto empieza por «[Smoobu] ERROR».
              </p>
              <p>
                <span className="font-medium">Cancelaciones:</span> solo se retira una limpieza si la reserva la
                había creado esta sincronización; las tareas ya iniciadas o completadas no se tocan.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
