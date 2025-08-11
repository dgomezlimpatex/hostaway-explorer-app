import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ArrowLeft, 
  Calendar, 
  FileText, 
  Package,
  ListOrdered,
  Save,
  X,
  Search,
  Building2,
  Plus,
  CheckCircle,
  Truck,
  PackagePlus
} from "lucide-react";

interface Picklist {
  id: string;
  code: string;
  status: "draft" | "preparing" | "packed" | "committed" | "cancelled";
  scheduled_date: string | null;
  notes: string | null;
  created_at: string;
}

interface PicklistItem {
  id: string;
  product_id: string;
  quantity: number;
  property_id: string | null;
  is_property_package: boolean;
  products_summary: Array<{
    quantity: number;
    product_id: string;
    product_name: string;
  }> | null;
  inventory_products: {
    name: string;
  };
  properties: {
    nombre: string;
    codigo: string;
  } | null;
}

interface Property {
  id: string;
  nombre: string;
  codigo: string;
}

const statusLabels = {
  draft: "Borrador",
  preparing: "Preparando", 
  packed: "Empacada",
  committed: "Confirmada",
  cancelled: "Cancelada"
};

const statusColors = {
  draft: "secondary",
  preparing: "default",
  packed: "outline", 
  committed: "default",
  cancelled: "destructive"
} as const;

export default function LogisticsPicklistEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [picklist, setPicklist] = useState<Picklist | null>(null);
  const [items, setItems] = useState<PicklistItem[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  
  // Form state
  const [code, setCode] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  
  // Items management state
  const [propFilter, setPropFilter] = useState("");
  const [selectedProps, setSelectedProps] = useState<Set<string>>(new Set());
  const [generateLoading, setGenerateLoading] = useState(false);
  const [taskStartDate, setTaskStartDate] = useState("");
  const [taskEndDate, setTaskEndDate] = useState("");

  useEffect(() => {
    if (id) {
      loadPicklist();
      loadProperties();
    }
  }, [id]);

  useEffect(() => {
    document.title = "Editar Picklist | Logística";
  }, []);

  async function loadPicklist() {
    if (!id) return;
    
    setLoading(true);
    
    const [picklistResponse, itemsResponse] = await Promise.all([
      supabase
        .from("logistics_picklists")
        .select("*")
        .eq("id", id)
        .single(),
      supabase
        .from("logistics_picklist_items")
        .select(`
          id, product_id, quantity, property_id, is_property_package, products_summary,
          inventory_products:product_id(name),
          properties:property_id(nombre, codigo)
        `)
        .eq("picklist_id", id)
    ]);
    
    if (picklistResponse.error) {
      toast({ 
        title: "Error cargando picklist", 
        description: picklistResponse.error.message, 
        variant: "destructive" 
      });
      navigate("/logistics/picklists");
      return;
    }
    
    if (itemsResponse.error) {
      toast({ 
        title: "Error cargando items", 
        description: itemsResponse.error.message, 
        variant: "destructive" 
      });
    }
    
    setPicklist(picklistResponse.data);
    setItems(itemsResponse.data as any || []);
    setCode(picklistResponse.data.code);
    setDate(picklistResponse.data.scheduled_date || "");
    setNotes(picklistResponse.data.notes || "");
    setLoading(false);
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
    
    setProperties(data);
  }

  async function savePicklist() {
    if (!id || !picklist) return;
    
    setSaving(true);
    const { error } = await supabase
      .from("logistics_picklists")
      .update({
        code: code.trim(),
        scheduled_date: date || null,
        notes: notes.trim() || null,
      })
      .eq("id", id);
    
    setSaving(false);
    
    if (error) {
      toast({ 
        title: "Error guardando cambios", 
        description: error.message, 
        variant: "destructive" 
      });
      return;
    }
    
    toast({ 
      title: "Picklist actualizada", 
      description: `Los cambios han sido guardados correctamente` 
    });
    
    // Reload picklist data
    loadPicklist();
  }

  const filteredProps = properties.filter(prop => 
    prop.nombre.toLowerCase().includes(propFilter.toLowerCase()) || 
    prop.codigo.toLowerCase().includes(propFilter.toLowerCase())
  );

  const toggleSelect = (propId: string) => {
    const newSelected = new Set(selectedProps);
    if (newSelected.has(propId)) {
      newSelected.delete(propId);
    } else {
      newSelected.add(propId);
    }
    setSelectedProps(newSelected);
  };

  async function generateFromSelected() {
    if (selectedProps.size === 0) {
      toast({ title: "Selección requerida", description: "Selecciona al menos una propiedad", variant: "destructive" });
      return;
    }
    
    setGenerateLoading(true);
    const { data, error } = await supabase.functions.invoke('logistics-operations', {
      body: {
        action: 'generate_from_properties',
        payload: {
          picklistId: id,
          propertyIds: Array.from(selectedProps)
        }
      }
    });
    
    setGenerateLoading(false);
    if (error) {
      toast({ title: "Error generando items", description: error.message, variant: "destructive" });
      return;
    }
    
    toast({ 
      title: "Items generados", 
      description: `Se crearon ${data.created} items y se actualizaron ${data.updated}` 
    });
    setSelectedProps(new Set());
    loadPicklist();
  }

  async function generateFromTasks() {
    if (!taskStartDate || !taskEndDate) {
      toast({ title: "Fechas requeridas", description: "Selecciona fecha de inicio y fin", variant: "destructive" });
      return;
    }
    
    setGenerateLoading(true);
    const { data, error } = await supabase.functions.invoke('logistics-operations', {
      body: {
        action: 'generate_from_tasks',
        payload: {
          picklistId: id,
          startDate: taskStartDate,
          endDate: taskEndDate
        }
      }
    });
    
    setGenerateLoading(false);
    if (error) {
      toast({ title: "Error generando items", description: error.message, variant: "destructive" });
      return;
    }
    
    toast({ 
      title: "Items generados desde tareas", 
      description: `Procesadas ${data.tasks} tareas de ${data.properties} propiedades. ${data.created} items creados, ${data.updated} actualizados.` 
    });
    loadPicklist();
  }

  async function markPacked() {
    setGenerateLoading(true);
    const { error } = await supabase.functions.invoke('logistics-operations', {
      body: {
        action: 'mark_packed',
        payload: { picklistId: id }
      }
    });
    
    setGenerateLoading(false);
    if (error) {
      toast({ title: "Error marcando como empacada", description: error.message, variant: "destructive" });
      return;
    }
    
    toast({ title: "Picklist empacada", description: "Estado actualizado correctamente" });
    loadPicklist();
  }

  async function createDelivery() {
    setGenerateLoading(true);
    const { data, error } = await supabase.functions.invoke('logistics-operations', {
      body: {
        action: 'create_delivery_from_picklist',
        payload: { picklistId: id }
      }
    });
    
    setGenerateLoading(false);
    if (error) {
      toast({ title: "Error creando delivery", description: error.message, variant: "destructive" });
      return;
    }
    
    toast({ 
      title: "Delivery creada", 
      description: `Delivery creada con ${data.stops} paradas y ${data.items} items` 
    });
    loadPicklist();
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
            <p className="text-lg font-medium text-muted-foreground">
              Cargando picklist...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!picklist) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium text-muted-foreground mb-2">
              Picklist no encontrada
            </p>
            <Button asChild variant="outline">
              <Link to="/logistics/picklists">Volver a Picklists</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/logistics/picklists" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Picklists</span>
              </Link>
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Package className="h-6 w-6 text-primary" />
                Editar Picklist
              </h1>
              <p className="text-sm text-muted-foreground">
                {picklist.code} - {formatDate(picklist.created_at)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statusColors[picklist.status]}>
              {statusLabels[picklist.status]}
            </Badge>
          </div>
        </div>

        {/* Edit Form */}
        <Card className="shadow-lg border-0 bg-gradient-to-r from-card to-card/80">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ListOrdered className="h-5 w-5 text-primary" />
              Información de la Picklist
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <ListOrdered className="h-4 w-4" />
                  Código *
                </label>
                <Input 
                  value={code} 
                  onChange={(e) => setCode(e.target.value)}
                  className="bg-background/50"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  El código debe ser único e identificativo
                </p>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Fecha programada
                </label>
                <Input 
                  type="date" 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-background/50"
                />
                <p className="text-xs text-muted-foreground">
                  Opcional - fecha prevista para procesar la picklist
                </p>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Notas
              </label>
              <Textarea 
                placeholder="Añadir notas o comentarios..."
                value={notes} 
                onChange={(e) => setNotes(e.target.value)}
                className="bg-background/50 min-h-[100px]"
              />
              <p className="text-xs text-muted-foreground">
                Información adicional, instrucciones especiales, etc.
              </p>
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
              <Button 
                onClick={savePicklist} 
                disabled={saving || !code.trim()}
                className="flex-1 sm:flex-none"
                size="lg"
              >
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Guardando..." : "Guardar Cambios"}
              </Button>
              
              <Button 
                variant="outline" 
                asChild
                className="flex-1 sm:flex-none"
                size="lg"
              >
                <Link to={`/logistics/picklists/${id}`} className="flex items-center gap-2">
                  <X className="h-4 w-4" />
                  Cancelar
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Items Management Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Properties Selection */}
          <Card className="shadow-lg border-0">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="h-5 w-5 text-primary" />
                Seleccionar Propiedades
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar propiedades..."
                  value={propFilter}
                  onChange={(e) => setPropFilter(e.target.value)}
                  className="pl-10 bg-background/50"
                />
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setSelectedProps(new Set(filteredProps.map(p => p.id)))}
                  className="flex-1"
                >
                  Todas
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setSelectedProps(new Set())}
                  className="flex-1"
                >
                  Ninguna
                </Button>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2">
                {filteredProps.map(prop => (
                  <div key={prop.id} className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded">
                    <Checkbox 
                      checked={selectedProps.has(prop.id)}
                      onCheckedChange={() => toggleSelect(prop.id)}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{prop.codigo} - {prop.nombre}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              <Button 
                onClick={generateFromSelected}
                disabled={generateLoading || selectedProps.size === 0}
                className="w-full"
              >
                <PackagePlus className="mr-2 h-4 w-4" />
                Generar desde seleccionadas ({selectedProps.size})
              </Button>
            </CardContent>
          </Card>

          {/* Generate from Tasks */}
          <Card className="shadow-lg border-0">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5 text-primary" />
                Generar desde Tareas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha inicio</label>
                <Input 
                  type="date"
                  value={taskStartDate}
                  onChange={(e) => setTaskStartDate(e.target.value)}
                  className="bg-background/50"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha fin</label>
                <Input 
                  type="date"
                  value={taskEndDate}
                  onChange={(e) => setTaskEndDate(e.target.value)}
                  className="bg-background/50"
                />
              </div>
              
              <Button 
                onClick={generateFromTasks}
                disabled={generateLoading || !taskStartDate || !taskEndDate}
                className="w-full"
              >
                <Calendar className="mr-2 h-4 w-4" />
                Generar desde tareas
              </Button>

              <Separator />

              {/* Actions */}
              <div className="space-y-2">
                {picklist.status === 'draft' && (
                  <Button 
                    onClick={markPacked}
                    disabled={generateLoading || items.length === 0}
                    variant="outline"
                    className="w-full"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Marcar como Empacada
                  </Button>
                )}
                
                {picklist.status === 'packed' && (
                  <Button 
                    onClick={createDelivery}
                    disabled={generateLoading}
                    className="w-full"
                  >
                    <Truck className="mr-2 h-4 w-4" />
                    Crear Delivery
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Items List */}
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5 text-primary" />
              Items de la Picklist ({items.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No hay items en esta picklist</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Selecciona propiedades o genera desde tareas para agregar items
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="p-4 border rounded-lg bg-muted/20">
                    {item.is_property_package ? (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" />
                            <span className="font-medium">
                              {item.properties?.codigo} - {item.properties?.nombre}
                            </span>
                          </div>
                          <Badge variant="outline">Paquete Propiedad</Badge>
                        </div>
                        {item.products_summary && (
                          <div className="ml-6 space-y-1">
                            {item.products_summary.map((product, idx) => (
                              <div key={idx} className="text-sm text-muted-foreground">
                                • {product.quantity}x {product.product_name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-primary" />
                          <span className="font-medium">{item.inventory_products.name}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">{item.quantity} unidades</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}