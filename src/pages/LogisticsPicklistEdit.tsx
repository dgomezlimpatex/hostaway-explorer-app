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
import { 
  ArrowLeft, 
  Calendar, 
  FileText, 
  Package,
  ListOrdered,
  Save,
  X
} from "lucide-react";

interface Picklist {
  id: string;
  code: string;
  status: "draft" | "preparing" | "packed" | "committed" | "cancelled";
  scheduled_date: string | null;
  notes: string | null;
  created_at: string;
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
  const [code, setCode] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (id) {
      loadPicklist();
    }
  }, [id]);

  useEffect(() => {
    document.title = "Editar Picklist | Logística";
  }, []);

  async function loadPicklist() {
    if (!id) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from("logistics_picklists")
      .select("*")
      .eq("id", id)
      .single();
    
    if (error) {
      toast({ 
        title: "Error cargando picklist", 
        description: error.message, 
        variant: "destructive" 
      });
      navigate("/logistics/picklists");
      return;
    }
    
    setPicklist(data);
    setCode(data.code);
    setDate(data.scheduled_date || "");
    setNotes(data.notes || "");
    setLoading(false);
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
    navigate(`/logistics/picklists/${id}`);
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

        {/* Info Card */}
        <Card className="shadow-lg border-0 bg-muted/20">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium text-muted-foreground">Estado actual:</span>
                <div className="mt-1">
                  <Badge variant={statusColors[picklist.status]}>
                    {statusLabels[picklist.status]}
                  </Badge>
                </div>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Creada:</span>
                <p className="mt-1">{formatDate(picklist.created_at)}</p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">ID:</span>
                <p className="mt-1 font-mono text-xs">{picklist.id}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}