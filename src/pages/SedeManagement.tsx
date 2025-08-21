import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  Building2, 
  Plus, 
  Edit, 
  Users, 
  MapPin,
  Phone,
  Mail,
  ArrowLeft
} from 'lucide-react';
import { useSedes } from '@/hooks/useSedes';
import { useToast } from '@/hooks/use-toast';
import { AppHeader } from '@/components/layout/AppHeader';

const SedeManagement = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingSede, setEditingSede] = useState<any>(null);
  const { 
    allSedes, 
    createSede, 
    updateSede, 
    loading,
    isCreating,
    isUpdating 
  } = useSedes();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nombre: '',
    codigo: '',
    ciudad: '',
    direccion: '',
    telefono: '',
    email: '',
    is_active: true
  });

  const resetForm = () => {
    setFormData({
      nombre: '',
      codigo: '',
      ciudad: '',
      direccion: '',
      telefono: '',
      email: '',
      is_active: true
    });
  };

  const handleCreate = async () => {
    if (!formData.nombre || !formData.codigo || !formData.ciudad) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos requeridos.",
        variant: "destructive",
      });
      return;
    }

    createSede(formData);
    // Los toasts y la invalidación se manejan automáticamente en el hook
    setIsCreateDialogOpen(false);
    resetForm();
  };

  const handleUpdate = async () => {
    if (!editingSede) return;
    
    if (!formData.nombre || !formData.codigo || !formData.ciudad) {
      toast({
        title: "Error", 
        description: "Por favor completa todos los campos requeridos.",
        variant: "destructive",
      });
      return;
    }

    updateSede({
      sedeId: editingSede.id,
      updates: formData
    });
    // Los toasts y la invalidación se manejan automáticamente en el hook
    setEditingSede(null);
    resetForm();
  };

  const openEditDialog = (sede: any) => {
    setEditingSede(sede);
    setFormData({
      nombre: sede.nombre,
      codigo: sede.codigo,
      ciudad: sede.ciudad,
      direccion: sede.direccion || '',
      telefono: sede.telefono || '',
      email: sede.email || '',
      is_active: sede.is_active
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Gestión de Sedes" />
      
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Volver al menú principal
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Building2 className="h-8 w-8 text-primary" />
                Gestión de Sedes
              </h1>
              <p className="text-muted-foreground mt-1">
                Administra las diferentes sedes y sucursales del sistema
              </p>
            </div>
          </div>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Nueva Sede
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nueva Sede</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nombre">Nombre *</Label>
                    <Input
                      id="nombre"
                      value={formData.nombre}
                      onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                      placeholder="Nombre de la sede"
                    />
                  </div>
                  <div>
                    <Label htmlFor="codigo">Código *</Label>
                    <Input
                      id="codigo"
                      value={formData.codigo}
                      onChange={(e) => setFormData(prev => ({ ...prev, codigo: e.target.value }))}
                      placeholder="Código único"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="ciudad">Ciudad *</Label>
                  <Input
                    id="ciudad"
                    value={formData.ciudad}
                    onChange={(e) => setFormData(prev => ({ ...prev, ciudad: e.target.value }))}
                    placeholder="Ciudad donde se ubica"
                  />
                </div>
                <div>
                  <Label htmlFor="direccion">Dirección</Label>
                  <Textarea
                    id="direccion"
                    value={formData.direccion}
                    onChange={(e) => setFormData(prev => ({ ...prev, direccion: e.target.value }))}
                    placeholder="Dirección completa"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="telefono">Teléfono</Label>
                    <Input
                      id="telefono"
                      value={formData.telefono}
                      onChange={(e) => setFormData(prev => ({ ...prev, telefono: e.target.value }))}
                      placeholder="Número de teléfono"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="Correo electrónico"
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                  />
                  <Label htmlFor="is_active">Sede activa</Label>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreate} disabled={isCreating}>
                    Crear Sede
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Sedes Table */}
        <Card>
          <CardHeader>
            <CardTitle>Sedes Registradas</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div>Cargando sedes...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Ciudad</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allSedes?.map((sede) => (
                    <TableRow key={sede.id}>
                      <TableCell className="font-medium">{sede.nombre}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{sede.codigo}</Badge>
                      </TableCell>
                      <TableCell className="flex items-center gap-1">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        {sede.ciudad}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {sede.telefono && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {sede.telefono}
                            </div>
                          )}
                          {sede.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              {sede.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={sede.is_active ? "default" : "secondary"}>
                          {sede.is_active ? "Activa" : "Inactiva"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(sede)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={!!editingSede} onOpenChange={() => setEditingSede(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Sede</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-nombre">Nombre *</Label>
                  <Input
                    id="edit-nombre"
                    value={formData.nombre}
                    onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-codigo">Código *</Label>
                  <Input
                    id="edit-codigo"
                    value={formData.codigo}
                    onChange={(e) => setFormData(prev => ({ ...prev, codigo: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-ciudad">Ciudad *</Label>
                <Input
                  id="edit-ciudad"
                  value={formData.ciudad}
                  onChange={(e) => setFormData(prev => ({ ...prev, ciudad: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="edit-direccion">Dirección</Label>
                <Textarea
                  id="edit-direccion"
                  value={formData.direccion}
                  onChange={(e) => setFormData(prev => ({ ...prev, direccion: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-telefono">Teléfono</Label>
                  <Input
                    id="edit-telefono"
                    value={formData.telefono}
                    onChange={(e) => setFormData(prev => ({ ...prev, telefono: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
                <Label htmlFor="edit-is_active">Sede activa</Label>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setEditingSede(null)}>
                  Cancelar
                </Button>
                <Button onClick={handleUpdate} disabled={isUpdating}>
                  Actualizar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default SedeManagement;