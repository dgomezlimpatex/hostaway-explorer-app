import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, RefreshCw } from "lucide-react";

interface Picklist {
  id: string;
  code: string;
  status: "draft" | "preparing" | "packed" | "committed" | "cancelled";
  scheduled_date: string | null;
  notes: string | null;
  created_at: string;
}

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

  return (
    <main className="container mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Logística · Picklists</h1>
        <link rel="canonical" href={window.location.href} />
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Nueva Picklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Código (opcional)" value={code} onChange={(e) => setCode(e.target.value)} />
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Textarea placeholder="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Button onClick={createPicklist} disabled={loading}>
              <Plus className="mr-2 h-4 w-4" /> Crear picklist
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
                  <TableHead>Código</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha programada</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.code}</TableCell>
                    <TableCell className="capitalize">{p.status}</TableCell>
                    <TableCell>{p.scheduled_date ?? "-"}</TableCell>
                    <TableCell className="max-w-[300px] truncate">{p.notes ?? ""}</TableCell>
                    <TableCell>
                      <Button asChild size="sm" variant="secondary">
                        <Link to={`/logistics/picklists/${p.id}`}>Ver</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {list.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      {loading ? "Cargando..." : "Sin picklists todavía"}
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
