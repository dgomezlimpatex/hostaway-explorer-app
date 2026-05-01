import { useState } from 'react';
import { Plus, Pencil, Trash2, Sparkles, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  useAllExtraordinaryRequestTypes,
  useUpsertExtraordinaryRequestType,
  useDeleteExtraordinaryRequestType,
} from '@/hooks/useExtraordinaryRequests';
import type { ExtraordinaryRequestType } from '@/types/extraordinaryRequest';

const emptyForm = {
  id: undefined as string | undefined,
  code: '',
  label: '',
  icon: '',
  description: '',
  defaultDurationMinutes: 15,
  requiresTime: false,
  defaultCost: 0,
  isActive: true,
  sortOrder: 0,
};

const ExtraordinaryRequestTypesAdmin = () => {
  const { data: types = [], isLoading } = useAllExtraordinaryRequestTypes();
  const upsert = useUpsertExtraordinaryRequestType();
  const remove = useDeleteExtraordinaryRequestType();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const openNew = () => { setForm(emptyForm); setOpen(true); };
  const openEdit = (t: ExtraordinaryRequestType) => {
    setForm({
      id: t.id,
      code: t.code,
      label: t.label,
      icon: t.icon ?? '',
      description: t.description ?? '',
      defaultDurationMinutes: t.defaultDurationMinutes,
      requiresTime: t.requiresTime,
      defaultCost: t.defaultCost,
      isActive: t.isActive,
      sortOrder: t.sortOrder,
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.code || !form.label) return;
    await upsert.mutateAsync(form as any);
    setOpen(false);
  };

  return (
    <div className="container max-w-5xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Tipos de servicios extraordinarios
          </h1>
          <p className="text-sm text-muted-foreground">
            Configura el catálogo de servicios que tus clientes pueden solicitar desde el portal.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo tipo
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Icono</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead className="text-right">Coste</TableHead>
                  <TableHead className="text-center">Duración</TableHead>
                  <TableHead className="text-center">Hora obligatoria</TableHead>
                  <TableHead className="text-center">Activo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="text-2xl">{t.icon ?? '✨'}</TableCell>
                    <TableCell className="font-medium">{t.label}</TableCell>
                    <TableCell><code className="text-xs">{t.code}</code></TableCell>
                    <TableCell className="text-right font-semibold text-emerald-600">
                      {t.defaultCost.toFixed(2)} €
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      {t.defaultDurationMinutes} min
                    </TableCell>
                    <TableCell className="text-center">
                      {t.requiresTime ? <Badge>Sí</Badge> : <Badge variant="outline">No</Badge>}
                    </TableCell>
                    <TableCell className="text-center">
                      {t.isActive ? <Badge className="bg-emerald-500/15 text-emerald-700">Activo</Badge> : <Badge variant="secondary">Inactivo</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8 text-rose-600"
                          onClick={() => { if (confirm(`¿Eliminar "${t.label}"?`)) remove.mutate(t.id); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {types.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No hay tipos. Crea el primero.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar tipo' : 'Nuevo tipo'}</DialogTitle>
            <DialogDescription>Configura los detalles del servicio.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Icono (emoji)</Label>
                <Input value={form.icon} onChange={(e) => setForm(f => ({ ...f, icon: e.target.value }))} placeholder="🛏️" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Nombre *</Label>
                <Input value={form.label} onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Cuna" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Código único *</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm(f => ({ ...f, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
                placeholder="cuna_extra"
                disabled={!!form.id}
              />
            </div>
            <div>
              <Label className="text-xs">Descripción (opcional)</Label>
              <Textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Coste (€)</Label>
                <Input type="number" min={0} step={0.5} value={form.defaultCost}
                  onChange={(e) => setForm(f => ({ ...f, defaultCost: Number(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label className="text-xs">Duración (min)</Label>
                <Input type="number" min={0} step={5} value={form.defaultDurationMinutes}
                  onChange={(e) => setForm(f => ({ ...f, defaultDurationMinutes: Number(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label className="text-xs">Orden</Label>
                <Input type="number" value={form.sortOrder}
                  onChange={(e) => setForm(f => ({ ...f, sortOrder: Number(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="flex items-center justify-between p-2 rounded border">
              <Label className="text-sm">Requiere hora específica</Label>
              <Switch checked={form.requiresTime} onCheckedChange={(v) => setForm(f => ({ ...f, requiresTime: v }))} />
            </div>
            <div className="flex items-center justify-between p-2 rounded border">
              <Label className="text-sm">Activo (visible para clientes)</Label>
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm(f => ({ ...f, isActive: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={!form.code || !form.label || upsert.isPending}>
              {upsert.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExtraordinaryRequestTypesAdmin;
