import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LogisticsLayout } from "@/components/logistics/LogisticsLayout";
import { LogisticsCard } from "@/components/logistics/LogisticsCard";
import { 
  Plus, 
  ListOrdered,
  Calendar, 
  FileText, 
  Package,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
  const [deleteTarget, setDeleteTarget] = useState<{id: string, code: string} | null>(null);

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
      setDeleteTarget(null);
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
    <LogisticsLayout
      title="Gestión de Picklists"
      subtitle="Crear y administrar listas de empaquetado"
      icon={Package}
      loading={loading}
      onRefresh={refresh}
      backUrl="/logistics/dashboard"
      backLabel="Dashboard"
    >
      {/* Create New Picklist Card */}
      <Card className="shadow-lg border-0 bg-gradient-to-br from-primary/5 to-primary/2">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plus className="h-5 w-5 text-primary" />
            Nueva Picklist
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <ListOrdered className="h-4 w-4" />
                Código
              </label>
              <Input 
                placeholder={genCode}
                value={code} 
                onChange={(e) => setCode(e.target.value)}
                className="bg-background/80 border-primary/20 focus:border-primary/40"
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
                className="bg-background/80 border-primary/20 focus:border-primary/40"
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
              className="bg-background/80 border-primary/20 focus:border-primary/40 min-h-[100px]"
            />
          </div>
          <Button 
            onClick={createPicklist} 
            disabled={loading}
            className="w-full sm:w-auto h-12 px-8 text-base font-medium shadow-lg hover:shadow-xl"
            size="lg"
          >
            <Plus className="mr-2 h-5 w-5" />
            Crear Picklist
          </Button>
        </CardContent>
      </Card>

      {/* Picklists List */}
      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="h-5 w-5 text-primary" />
            Picklists ({list.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <div className="text-center py-16">
              <Package className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
              <div className="space-y-2">
                <p className="text-xl font-medium text-muted-foreground">
                  {loading ? "Cargando picklists..." : "No hay picklists"}
                </p>
                {!loading && (
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Crea tu primera picklist usando el formulario de arriba para comenzar a gestionar tus operaciones logísticas
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {list.map((picklist) => (
                <LogisticsCard
                  key={picklist.id}
                  type="picklist"
                  id={picklist.id}
                  code={picklist.code}
                  status={picklist.status}
                  title={picklist.code}
                  subtitle={`Creada: ${formatDate(picklist.created_at)}`}
                  scheduledDate={picklist.scheduled_date}
                  notes={picklist.notes}
                  onEdit={() => {}}
                  onDelete={() => setDeleteTarget({id: picklist.id, code: picklist.code})}
                  className="hover-lift"
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar picklist?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente la picklist 
              <span className="font-semibold"> {deleteTarget?.code}</span> y todos sus datos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteTarget && deletePicklist(deleteTarget.id, deleteTarget.code)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </LogisticsLayout>
  );
}
