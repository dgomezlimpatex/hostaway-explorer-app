import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Plus, 
  RefreshCw, 
  ArrowLeft, 
  Calendar, 
  FileText, 
  Package,
  Eye,
  ListOrdered,
  Edit,
  Trash2,
  MoreVertical
} from "lucide-react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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

export default function LogisticsPicklists() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<Picklist[]>([]);
  const [code, setCode] = useState("");
  const [date, setDate] = useState<string>("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    document.title = "Logística: Picklists | Operaciones";
    refresh();
  }, []);

  const genCode = useMemo(() => {
    const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const rnd = Math.floor(1000 + Math.random() * 9000);
    return `PKL-${ymd}-${rnd}`;
  }, [list.length]);

  async function refresh() {
    setLoading(true);
    const { data, error } = await supabase
      .from("logistics_picklists")
      .select("id, code, status, scheduled_date, notes, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Error cargando picklists", description: error.message, variant: "destructive" });
    } else {
      setList(data as any);
    }
    setLoading(false);
  }

  async function deletePicklist(id: string, code: string) {
    setLoading(true);
    const { error } = await supabase
      .from("logistics_picklists")
      .delete()
      .eq("id", id);
    
    setLoading(false);
    if (error) {
      toast({ 
        title: "Error al eliminar", 
        description: error.message, 
        variant: "destructive" 
      });
    } else {
      toast({ 
        title: "Picklist eliminada", 
        description: `${code} ha sido eliminada correctamente` 
      });
      refresh();
    }
  }

  async function createPicklist() {
    const finalCode = code.trim() || genCode;
    setLoading(true);
    const { error } = await supabase.from("logistics_picklists").insert({
      code: finalCode,
      scheduled_date: date || null,
      notes: notes || null,
    });
    setLoading(false);
    if (error) {
      toast({ title: "No se pudo crear", description: error.message, variant: "destructive" });
      return;
    }
    setCode("");
    setDate("");
    setNotes("");
    toast({ title: "Picklist creada", description: finalCode });
    refresh();
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Package className="h-6 w-6 text-primary" />
                Logística
              </h1>
              <p className="text-sm text-muted-foreground">Gestión de Picklists</p>
            </div>
          </div>
          <Button onClick={refresh} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>

        {/* Create New Picklist Card */}
        <Card className="shadow-lg border-0 bg-gradient-to-r from-card to-card/80">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plus className="h-5 w-5 text-primary" />
              Nueva Picklist
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <ListOrdered className="h-4 w-4" />
                  Código
                </label>
                <Input 
                  placeholder={genCode}
                  value={code} 
                  onChange={(e) => setCode(e.target.value)}
                  className="bg-background/50"
                />
                <p className="text-xs text-muted-foreground">
                  Opcional - se generará automáticamente si se deja vacío
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
                className="bg-background/50 min-h-[80px]"
              />
            </div>
            <Button 
              onClick={createPicklist} 
              disabled={loading}
              className="w-full sm:w-auto"
              size="lg"
            >
              <Plus className="mr-2 h-4 w-4" />
              Crear Picklist
            </Button>
          </CardContent>
        </Card>

        {/* Picklists List */}
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5 text-primary" />
                Picklists ({list.length})
              </CardTitle>
              <Badge variant="outline" className="hidden sm:inline-flex">
                {loading ? "Cargando..." : `${list.length} total`}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {list.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium text-muted-foreground mb-2">
                  {loading ? "Cargando picklists..." : "No hay picklists"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {!loading && "Crea tu primera picklist usando el formulario de arriba"}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Desktop Table View */}
                <div className="hidden lg:block">
                  <div className="grid grid-cols-5 gap-4 p-4 bg-muted/30 rounded-lg font-medium text-sm">
                    <div>Código</div>
                    <div>Estado</div>
                    <div>Fecha</div>
                    <div>Notas</div>
                    <div>Acciones</div>
                  </div>
                  {list.map((picklist) => (
                    <div key={picklist.id} className="grid grid-cols-5 gap-4 p-4 border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <div className="font-medium">{picklist.code}</div>
                      <div>
                        <Badge variant={statusColors[picklist.status]}>
                          {statusLabels[picklist.status]}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(picklist.scheduled_date)}
                      </div>
                      <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                        {picklist.notes || "-"}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/logistics/picklists/${picklist.id}`} className="flex items-center gap-1">
                            <Eye className="h-4 w-4" />
                            Ver
                          </Link>
                        </Button>
                        
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/logistics/picklists/${picklist.id}/edit`} className="flex items-center gap-1">
                            <Edit className="h-4 w-4" />
                            Editar
                          </Link>
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                              Eliminar
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar picklist?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer. Se eliminará permanentemente la picklist 
                                <span className="font-semibold"> {picklist.code}</span> y todos sus datos asociados.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => deletePicklist(picklist.id, picklist.code)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden space-y-3">
                  {list.map((picklist) => (
                    <Card key={picklist.id} className="border border-border/50 hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="font-semibold text-lg">{picklist.code}</div>
                          <Badge variant={statusColors[picklist.status]}>
                            {statusLabels[picklist.status]}
                          </Badge>
                        </div>
                        
                        <div className="space-y-2 mb-4">
                          {picklist.scheduled_date && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              {formatDate(picklist.scheduled_date)}
                            </div>
                          )}
                          {picklist.notes && (
                            <div className="flex items-start gap-2 text-sm text-muted-foreground">
                              <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
                              <span className="line-clamp-2">{picklist.notes}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <Button asChild size="sm" variant="outline" className="flex-1 mr-2">
                            <Link to={`/logistics/picklists/${picklist.id}`} className="flex items-center justify-center gap-2">
                              <Eye className="h-4 w-4" />
                              Ver
                            </Link>
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="px-2">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link to={`/logistics/picklists/${picklist.id}/edit`} className="flex items-center gap-2">
                                  <Edit className="h-4 w-4" />
                                  Editar
                                </Link>
                              </DropdownMenuItem>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem 
                                    onSelect={(e) => e.preventDefault()}
                                    className="text-destructive focus:text-destructive cursor-pointer"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Eliminar
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar picklist?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta acción no se puede deshacer. Se eliminará permanentemente la picklist 
                                      <span className="font-semibold"> {picklist.code}</span> y todos sus datos asociados.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => deletePicklist(picklist.id, picklist.code)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
