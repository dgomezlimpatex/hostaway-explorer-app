import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ArrowLeft, PackagePlus, CheckCheck, Truck } from "lucide-react";

interface PicklistItem { id: string; product_id: string; quantity: number; property_id: string | null; }
interface Property { id: string; nombre: string; codigo: string; }

export default function LogisticsPicklistDetails() {
  const { id } = useParams();
  const { toast } = useToast();
  const [header, setHeader] = useState<any>(null);
  const [items, setItems] = useState<PicklistItem[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0,10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0,10));

  useEffect(() => {
    document.title = "Detalle de Picklist | Logística";
    if (id) {
      load();
      loadProperties();
    }
  }, [id]);

  async function load() {
    const [{ data: pick }, { data: lines, error: e2 }] = await Promise.all([
      supabase.from("logistics_picklists").select("id, code, status, scheduled_date, notes, created_at").eq("id", id!).maybeSingle(),
      supabase.from("logistics_picklist_items").select("id, product_id, quantity, property_id").eq("picklist_id", id!),
    ]);
    if (!pick) {
      toast({ title: "Picklist no encontrada", variant: "destructive" });
      return;
    }
    if (e2) {
      toast({ title: "Error cargando items", description: e2.message, variant: "destructive" });
    }
    setHeader(pick);
    setItems((lines as any) || []);
  }

  async function loadProperties() {
    const { data, error } = await supabase
      .from("properties")
      .select("id, nombre, codigo")
      .order("nombre", { ascending: true });
    if (error) {
      toast({ title: "Error cargando propiedades", description: error.message, variant: "destructive" });
      return;
    }
    setProperties((data as any) || []);
  }

  const filteredProps = properties.filter(p =>
    [p.nombre, p.codigo].join(" ").toLowerCase().includes(filter.toLowerCase())
  );

  const toggleSelect = (id: string, value: boolean) => {
    setSelected(prev => ({ ...prev, [id]: value }));
  };

  async function generateFromSelected() {
    const propertyIds = Object.keys(selected).filter(k => selected[k]);
    if (!propertyIds.length) {
      toast({ title: "Selecciona al menos una propiedad" });
      return;
    }
    const { data, error } = await supabase.functions.invoke("logistics-operations", {
      body: { action: "generate_from_properties", payload: { picklistId: id, propertyIds } }
    });
    if (error) {
      toast({ title: "Error generando items", description: (error as any).message, variant: "destructive" });
      return;
    }
    toast({ title: "Items añadidos", description: `Creados: ${data?.created || 0}, Actualizados: ${data?.updated || 0}` });
    load();
  }

  async function generateFromTasks() {
    if (!startDate || !endDate) {
      toast({ title: "Selecciona un rango de fechas" });
      return;
    }
    const { data, error } = await supabase.functions.invoke("logistics-operations", {
      body: { action: "generate_from_tasks", payload: { picklistId: id, startDate, endDate } }
    });
    if (error) {
      toast({ title: "Error generando desde tareas", description: (error as any).message, variant: "destructive" });
      return;
    }
    toast({ title: "Items añadidos desde tareas", description: `Props: ${data?.properties || 0}, Tareas: ${data?.tasks || 0}` });
    load();
  }

  async function markPacked() {
    const { error } = await supabase.functions.invoke("logistics-operations", {
      body: { action: "mark_packed", payload: { picklistId: id } }
    });
    if (error) {
      toast({ title: "Error al marcar empaquetado", description: (error as any).message, variant: "destructive" });
      return;
    }
    toast({ title: "Picklist marcada como empaquetada" });
    load();
  }

  async function createDelivery() {
    const { data, error } = await supabase.functions.invoke("logistics-operations", {
      body: { action: "create_delivery_from_picklist", payload: { picklistId: id } }
    });
    if (error) {
      toast({ title: "Error creando entrega", description: (error as any).message, variant: "destructive" });
      return;
    }
    toast({ title: "Entrega creada", description: `ID: ${data?.deliveryId}` });
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <header className="mb-6 flex items-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link to="/logistics/picklists"><ArrowLeft className="h-4 w-4 mr-1"/> Volver</Link>
        </Button>
        <h1 className="text-2xl font-bold">Picklist {header?.code ?? ""}</h1>
        <link rel="canonical" href={window.location.href} />
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p><span className="font-medium">Estado:</span> <span className="capitalize">{header?.status}</span></p>
            <p><span className="font-medium">Programado:</span> {header?.scheduled_date ?? '-'}</p>
            <p><span className="font-medium">Notas:</span> {header?.notes ?? '-'}</p>
            <p><span className="font-medium">Creado:</span> {header?.created_at?.slice(0,10)}</p>
            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="secondary" onClick={generateFromSelected}>
                <PackagePlus className="h-4 w-4 mr-1"/> Añadir items
              </Button>
              <Button size="sm" onClick={markPacked}>
                <CheckCheck className="h-4 w-4 mr-1"/> Marcar empaquetado
              </Button>
              <Button size="sm" variant="outline" onClick={createDelivery}>
                <Truck className="h-4 w-4 mr-1"/> Crear entrega
              </Button>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              <Button size="sm" variant="secondary" onClick={generateFromTasks}>Desde tareas</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Propiedades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <Input placeholder="Buscar por nombre o código" value={filter} onChange={(e) => setFilter(e.target.value)} />
              <Button variant="ghost" size="sm" onClick={() => setSelected(Object.fromEntries(properties.map(p => [p.id, true])))}>Todas</Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected({})}>Ninguna</Button>
            </div>
            <div className="max-h-80 overflow-auto divide-y">
              {filteredProps.map((p) => (
                <label key={p.id} className="flex items-center gap-3 py-2 cursor-pointer">
                  <Checkbox checked={!!selected[p.id]} onCheckedChange={(v) => toggleSelect(p.id, Boolean(v))} />
                  <div>
                    <div className="font-medium">{p.nombre}</div>
                    <div className="text-xs text-muted-foreground">Código: {p.codigo}</div>
                  </div>
                </label>
              ))}
              {filteredProps.length === 0 && (
                <div className="text-sm text-muted-foreground">No hay propiedades</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Items ({items.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Propiedad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(i => (
                  <TableRow key={i.id}>
                    <TableCell>{i.product_id}</TableCell>
                    <TableCell>{i.quantity}</TableCell>
                    <TableCell>{i.property_id ?? '-'}</TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">Sin items aún</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
