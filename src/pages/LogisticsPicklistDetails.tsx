import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, PackagePlus, CheckCheck, Truck, Calendar, FileText, Package, Search, Users, Plus, Clock } from "lucide-react";
import { PropertyPackageCard } from "@/components/logistics/PropertyPackageCard";

interface PicklistItem { 
  id: string; 
  product_id: string; 
  quantity: number; 
  property_id: string | null;
  inventory_products?: { name: string };
  properties?: { nombre: string; codigo: string };
  is_property_package?: boolean;
  products_summary?: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
  }>;
}
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
      supabase.from("logistics_picklist_items").select(`
        id, 
        product_id, 
        quantity, 
        property_id,
        is_property_package,
        products_summary,
        inventory_products:product_id(name),
        properties:property_id(nombre, codigo)
      `).eq("picklist_id", id!),
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft': return <Badge variant="secondary"><FileText className="h-3 w-3 mr-1" />Borrador</Badge>;
      case 'packed': return <Badge variant="default"><Package className="h-3 w-3 mr-1" />Empaquetado</Badge>;
      case 'committed': return <Badge variant="outline"><CheckCheck className="h-3 w-3 mr-1" />Entregado</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header optimizado */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <Link to="/logistics/picklists">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Volver a Picklists</span>
                  <span className="sm:hidden">Volver</span>
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                  {header?.code ?? "Cargando..."}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Gestión de productos y entregas
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {header?.status && getStatusBadge(header.status)}
            </div>
          </div>
          <link rel="canonical" href={window.location.href} />
        </div>

        {/* Layout responsivo mejorado */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Panel de información y acciones */}
          <div className="xl:col-span-4 space-y-6">
            {/* Información de la picklist */}
            <Card className="border-2">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Información General
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</div>
                    <div>{header?.status && getStatusBadge(header.status)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Items</div>
                    <div className="flex items-center gap-1">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{items.length}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fecha programada</div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{header?.scheduled_date ?? 'No programado'}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Creado</div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{header?.created_at?.slice(0,10)}</span>
                    </div>
                  </div>
                </div>
                
                {header?.notes && (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notas</div>
                      <p className="text-sm bg-muted/50 p-3 rounded-lg">{header.notes}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Acciones principales */}
            <Card className="border-2">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <CheckCheck className="h-5 w-5 text-primary" />
                  Acciones
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3">
                  <Button 
                    onClick={generateFromSelected} 
                    className="w-full justify-start"
                    variant="default"
                    disabled={Object.keys(selected).filter(k => selected[k]).length === 0}
                  >
                    <PackagePlus className="h-4 w-4 mr-2" />
                    Añadir desde propiedades
                  </Button>
                  
                  <Button 
                    onClick={markPacked} 
                    variant="secondary" 
                    className="w-full justify-start"
                    disabled={header?.status !== 'draft'}
                  >
                    <CheckCheck className="h-4 w-4 mr-2" />
                    Marcar empaquetado
                  </Button>
                  
                  <Button 
                    onClick={createDelivery} 
                    variant="outline" 
                    className="w-full justify-start"
                    disabled={header?.status !== 'packed'}
                  >
                    <Truck className="h-4 w-4 mr-2" />
                    Crear entrega
                  </Button>
                </div>

                <Separator />
                
                {/* Generar desde tareas */}
                <div className="space-y-3">
                  <div className="text-sm font-medium">Generar desde tareas</div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input 
                      type="date" 
                      value={startDate} 
                      onChange={(e) => setStartDate(e.target.value)}
                      className="flex-1"
                    />
                    <Input 
                      type="date" 
                      value={endDate} 
                      onChange={(e) => setEndDate(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                  <Button 
                    onClick={generateFromTasks} 
                    variant="secondary" 
                    className="w-full justify-start"
                    disabled={!startDate || !endDate}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Generar desde tareas
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Panel de propiedades */}
          <div className="xl:col-span-4">
            <Card className="border-2 h-fit">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Seleccionar Propiedades
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Barra de búsqueda mejorada */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar por nombre o código" 
                    value={filter} 
                    onChange={(e) => setFilter(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                {/* Botones de selección */}
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setSelected(Object.fromEntries(filteredProps.map(p => [p.id, true])))}
                    className="flex-1"
                  >
                    Todas ({filteredProps.length})
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setSelected({})}
                    className="flex-1"
                  >
                    Ninguna
                  </Button>
                </div>

                <Separator />

                {/* Lista de propiedades mejorada */}
                <div className="max-h-96 overflow-y-auto">
                  <div className="space-y-2">
                    {filteredProps.map((p) => (
                      <label 
                        key={p.id} 
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <Checkbox 
                          checked={!!selected[p.id]} 
                          onCheckedChange={(v) => toggleSelect(p.id, Boolean(v))} 
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{p.nombre}</div>
                          <div className="text-xs text-muted-foreground">Código: {p.codigo}</div>
                        </div>
                      </label>
                    ))}
                    {filteredProps.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No hay propiedades disponibles</p>
                      </div>
                    )}
                  </div>
                </div>

                {Object.keys(selected).filter(k => selected[k]).length > 0 && (
                  <div className="bg-primary/10 p-3 rounded-lg">
                    <div className="text-sm font-medium text-primary">
                      {Object.keys(selected).filter(k => selected[k]).length} propiedades seleccionadas
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Panel de items */}
          <div className="xl:col-span-4">
            <Card className="border-2">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    Items de la Picklist
                  </div>
                  <Badge variant="secondary">{items.length} items</Badge>
                </CardTitle>
              </CardHeader>
               <CardContent>
                {items.length > 0 ? (
                  <div className="space-y-3">
                    <div className="max-h-96 overflow-y-auto space-y-3">
                      {items
                        .filter(item => item.is_property_package)
                        .map(item => (
                          <PropertyPackageCard
                            key={item.id}
                            propertyCode={item.properties?.codigo || 'Sin código'}
                            propertyName={item.properties?.nombre || 'Propiedad sin nombre'}
                            totalItems={item.quantity}
                            products={item.products_summary || []}
                          />
                        ))}
                      
                      {/* Fallback para items antiguos que no son paquetes */}
                      {items.filter(item => !item.is_property_package).length > 0 && (
                        <div className="border-t pt-3 mt-3">
                          <h4 className="text-sm font-medium mb-2 text-muted-foreground">Items individuales (formato anterior)</h4>
                          <div className="space-y-1">
                            {items
                              .filter(item => !item.is_property_package)
                              .map(item => (
                                <div key={item.id} className="flex justify-between items-center p-2 bg-muted/30 rounded text-xs">
                                  <span>{item.inventory_products?.name || 'Producto no encontrado'}</span>
                                  <Badge variant="outline" className="text-xs">{item.quantity}</Badge>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="font-medium text-lg mb-2">Sin paquetes aún</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Selecciona propiedades y haz clic en "Añadir desde propiedades" para crear paquetes por propiedad
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
