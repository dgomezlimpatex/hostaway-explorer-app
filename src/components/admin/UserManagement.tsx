
import React, { useState } from 'react';
import { useInvitations, useCreateInvitation, useRevokeInvitation } from '@/hooks/useInvitations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Mail, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

const roleLabels: Record<AppRole, string> = {
  admin: 'Administrador',
  manager: 'Manager',
  supervisor: 'Supervisor',
  cleaner: 'Limpiador',
  client: 'Cliente',
};

const statusLabels = {
  pending: 'Pendiente',
  accepted: 'Aceptada',
  expired: 'Expirada',
  revoked: 'Revocada',
};

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  accepted: 'bg-green-100 text-green-800',
  expired: 'bg-gray-100 text-gray-800',
  revoked: 'bg-red-100 text-red-800',
};

const statusIcons = {
  pending: Clock,
  accepted: CheckCircle,
  expired: AlertTriangle,
  revoked: XCircle,
};

export const UserManagement = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AppRole>('cleaner');

  const { data: invitations, isLoading } = useInvitations();
  const createInvitation = useCreateInvitation();
  const revokeInvitation = useRevokeInvitation();

  const handleCreateInvitation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    createInvitation.mutate(
      { email: email.trim(), role },
      {
        onSuccess: () => {
          setEmail('');
          setRole('cleaner');
          setIsOpen(false);
        },
      }
    );
  };

  const handleRevokeInvitation = (invitationId: string) => {
    if (confirm('¿Estás seguro de que quieres revocar esta invitación?')) {
      revokeInvitation.mutate(invitationId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p>Cargando invitaciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h2>
          <p className="text-gray-600">Invita nuevos usuarios y gestiona el acceso al sistema</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Invitar Usuario
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invitar Nuevo Usuario</DialogTitle>
              <DialogDescription>
                Envía una invitación para que un nuevo usuario se una al sistema.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleCreateInvitation} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@ejemplo.com"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="role">Rol</Label>
                <Select value={role} onValueChange={(value: AppRole) => setRole(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="cleaner">Limpiador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createInvitation.isPending}>
                  {createInvitation.isPending ? 'Enviando...' : 'Enviar Invitación'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Invitaciones</h3>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha de Creación</TableHead>
              <TableHead>Expira</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations?.map((invitation) => {
              const StatusIcon = statusIcons[invitation.status];
              const isExpired = new Date(invitation.expires_at) < new Date();
              const canRevoke = invitation.status === 'pending' && !isExpired;
              
              return (
                <TableRow key={invitation.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center">
                      <Mail className="h-4 w-4 mr-2 text-gray-400" />
                      {invitation.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {roleLabels[invitation.role]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <StatusIcon className="h-4 w-4 mr-2" />
                      <Badge className={statusColors[invitation.status]}>
                        {statusLabels[invitation.status]}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(invitation.created_at).toLocaleDateString('es-ES')}
                  </TableCell>
                  <TableCell>
                    <span className={isExpired ? 'text-red-600 font-medium' : 'text-gray-600'}>
                      {new Date(invitation.expires_at).toLocaleDateString('es-ES')}
                    </span>
                  </TableCell>
                  <TableCell>
                    {canRevoke && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRevokeInvitation(invitation.id)}
                        disabled={revokeInvitation.isPending}
                      >
                        Revocar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {invitations?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  No hay invitaciones registradas
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
