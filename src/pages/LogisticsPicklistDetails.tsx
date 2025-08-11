import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Package, 
  Calendar, 
  FileText, 
  Building2,
  Edit
} from "lucide-react";

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

export default function LogisticsPicklistDetails() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [picklist, setPicklist] = useState<any>(null);
  const [items, setItems] = useState<PicklistItem[]>([]);

  useEffect(() => {
    if (id) {
      load();
    }
  }, [id]);

  useEffect(() => {
    document.title = picklist ? `Picklist ${picklist.code} | Logística` : "Detalle Picklist | Logística";
  }, [picklist]);

  async function load() {
    if (!id) return;
    setLoading(true);
    
    const [picklistResponse, itemsResponse] = await Promise.all([
      supabase
        .from("logistics_picklists")
        .select("id, code, status, scheduled_date, notes, created_at")
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
      toast({ title: "Error cargando picklist", description: picklistResponse.error.message, variant: "destructive" });
      return;
    }
    
    if (itemsResponse.error) {
      toast({ title: "Error cargando items", description: itemsResponse.error.message, variant: "destructive" });
      return;
    }
    
    setPicklist(picklistResponse.data);
    setItems(itemsResponse.data as any);
    setLoading(false);
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
                {picklist.code}
              </h1>
              <p className="text-sm text-muted-foreground">
                Creada el {formatDate(picklist.created_at)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link to={`/logistics/picklists/${id}/edit`} className="flex items-center gap-2">
                <Edit className="h-4 w-4" />
                Editar
              </Link>
            </Button>
            <Badge variant={statusColors[picklist.status]}>
              {statusLabels[picklist.status]}
            </Badge>
          </div>
        </div>

        {/* Picklist Info */}
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-primary" />
              Información de la Picklist
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Estado</p>
              <Badge variant={statusColors[picklist.status]} className="text-sm">
                {statusLabels[picklist.status]}
              </Badge>
            </div>
            {picklist.scheduled_date && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Fecha programada
                </p>
                <p className="text-sm">{formatDate(picklist.scheduled_date)}</p>
              </div>
            )}
            {picklist.notes && (
              <div className="space-y-1 md:col-span-2">
                <p className="text-sm font-medium text-muted-foreground">Notas</p>
                <p className="text-sm">{picklist.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

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
                  Usa el botón "Editar" para agregar items
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