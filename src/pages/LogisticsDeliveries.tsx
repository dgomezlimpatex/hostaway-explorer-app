import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, RefreshCw } from "lucide-react";

interface Delivery { id: string; status: string; picklist_id: string | null; created_at: string; }
interface Picklist { id: string; code: string; status: string; }

export default function LogisticsDeliveries() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [picklists, setPicklists] = useState<Picklist[]>([]);
  const [picklistId, setPicklistId] = useState<string>("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    document.title = "Logística: Entregas | Operaciones";
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    const [{ data: dels, error: e1 }, { data: pkls, error: e2 }] = await Promise.all([
      supabase.from("logistics_deliveries").select("id, status, picklist_id, created_at").order("created_at", { ascending: false }),
      supabase.from("logistics_picklists").select("id, code, status").order("created_at", { ascending: false }),
    ]);
    if (e1) toast({ title: "Error cargando entregas", description: e1.message, variant: "destructive" });
    if (e2) toast({ title: "Error cargando picklists", description: e2.message, variant: "destructive" });
    setDeliveries((dels as any) || []);
    setPicklists((pkls as any) || []);
    setLoading(false);
  }

  async function createDelivery() {
    if (!picklistId) {
      toast({ title: "Selecciona una picklist" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("logistics_deliveries").insert({
      picklist_id: picklistId,
      notes: notes || null,
    });
    setLoading(false);
    if (error) {
      toast({ title: "No se pudo crear", description: error.message, variant: "destructive" });
      return;
    }
    setPicklistId("");
    setNotes("");
    toast({ title: "Entrega creada" });
    refresh();
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Logística · Entregas</h1>
        <link rel="canonical" href={window.location.href} />
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Nueva Entrega</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={picklistId} onValueChange={setPicklistId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una picklist" />
              </SelectTrigger>
              <SelectContent>
                {picklists.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.code} · {p.status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Button onClick={createDelivery} disabled={loading}>
              <Plus className="mr-2 h-4 w-4" /> Crear entrega
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Listado</CardTitle>
            <Button variant="outline" onClick={refresh} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" /> Actualizar
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Creada</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Picklist</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.map(d => (
                  <TableRow key={d.id}>
                    <TableCell>{d.created_at?.slice(0,10)}</TableCell>
                    <TableCell className="capitalize">{d.status}</TableCell>
                    <TableCell>{picklists.find(p => p.id === d.picklist_id)?.code ?? '-'}</TableCell>
                  </TableRow>
                ))}
                {deliveries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                      {loading ? "Cargando..." : "Sin entregas todavía"}
                    </TableCell>
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
