import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

interface PicklistItem { id: string; product_id: string; quantity: number; property_id: string | null; }

export default function LogisticsPicklistDetails() {
  const { id } = useParams();
  const { toast } = useToast();
  const [header, setHeader] = useState<any>(null);
  const [items, setItems] = useState<PicklistItem[]>([]);

  useEffect(() => {
    document.title = "Detalle de Picklist | Logística";
    if (id) load();
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
          <CardContent className="space-y-2 text-sm">
            <p><span className="font-medium">Estado:</span> <span className="capitalize">{header?.status}</span></p>
            <p><span className="font-medium">Programado:</span> {header?.scheduled_date ?? '-'}</p>
            <p><span className="font-medium">Notas:</span> {header?.notes ?? '-'}</p>
            <p><span className="font-medium">Creado:</span> {header?.created_at?.slice(0,10)}</p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
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
