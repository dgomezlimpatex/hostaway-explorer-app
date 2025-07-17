import React, { useState } from 'react';
import { useInvitations, useCreateInvitation, useRevokeInvitation } from '@/hooks/useInvitations';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCleaners } from '@/hooks/useCleaners';
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
import { UserPlus, Mail, Clock, CheckCircle, XCircle, AlertTriangle, Copy, ArrowLeft, Users, Trash2, UserCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';
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
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invitations, isLoading } = useInvitations();
  const { cleaners } = useCleaners();
  const createInvitation = useCreateInvitation();
  const revokeInvitation = useRevokeInvitation();

  // Query para obtener usuarios activos
  const { data: activeUsers, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['active-users'],
    queryFn: async () => {
      // Primero obtener los user_roles
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role, created_at');
      
      if (rolesError) throw rolesError;
      
      // Luego obtener los profiles para cada user_id
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userRoles.map(ur => ur.user_id));
      
      if (profilesError) throw profilesError;
      
      // Combinar los datos
      const combinedData = userRoles.map(userRole => ({
        ...userRole,
        profiles: profiles.find(p => p.id === userRole.user_id) || { email: '', full_name: '' }
      }));
      
      return combinedData;
    }
  });

  // Mutation para añadir cleaner
  const addCleanerMutation = useMutation({
    mutationFn: async ({ userId, email, name }: { userId: string; email: string; name: string }) => {
      const { error } = await supabase
        .from('cleaners')
        .insert({
          user_id: userId,
          name: name || email,
          email,
          is_active: true
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cleaners'] });
      toast({
        title: 'Trabajador añadido',
        description: 'El usuario ha sido añadido a la lista de trabajadores.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'No se pudo añadir el trabajador.',
        variant: 'destructive',
      });
    }
  });

  // Mutation para eliminar usuario completamente
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      // 1. Primero eliminar el rol
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
      
      if (roleError) throw roleError;

      // 2. Eliminar de cleaners si existe
      const { error: cleanerError } = await supabase
        .from('cleaners')
        .delete()
        .eq('user_id', userId);
      
      // No lanzar error si no existe en cleaners
      console.log('Cleaner deletion result:', cleanerError);

      // 3. Eliminar completamente el usuario de auth.users
      // Esto también eliminará automáticamente el profile por CASCADE
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);
      
      if (authError) {
        console.error('Error deleting user from auth:', authError);
        throw new Error('No se pudo eliminar el usuario de la autenticación');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-users'] });
      queryClient.invalidateQueries({ queryKey: ['cleaners'] });
      toast({
        title: 'Usuario eliminado completamente',
        description: 'El usuario ha sido eliminado del sistema y puede ser invitado nuevamente.',
      });
    },
    onError: (error) => {
      console.error('Delete user error:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el usuario completamente.',
        variant: 'destructive',
      });
    }
  });

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

  const handleAddCleaner = (user: any) => {
    addCleanerMutation.mutate({
      userId: user.user_id,
      email: user.profiles.email,
      name: user.profiles.full_name || user.profiles.email
    });
  };

  const handleDeleteUser = (userId: string) => {
    deleteUserMutation.mutate(userId);
  };

  const isUserInCleaners = (userId: string) => {
    return cleaners?.some(cleaner => cleaner.user_id === userId);
  };

  const copyInvitationLink = (invitation: any) => {
    const appUrl = window.location.origin;
    const invitationUrl = `${appUrl}/accept-invitation?token=${invitation.invitation_token}&email=${encodeURIComponent(invitation.email)}`;
    
    navigator.clipboard.writeText(invitationUrl).then(() => {
      toast({
        title: 'Enlace copiado',
        description: 'El enlace de invitación se ha copiado al portapapeles.',
      });
    });
  };

  if (isLoading || isLoadingUsers) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p>Cargando datos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="sm" className="hover:bg-gray-100">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al Menú
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h2>
            <p className="text-gray-600">Invita nuevos usuarios y gestiona el acceso al sistema</p>
          </div>
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
                Envía una invitación por email para que un nuevo usuario se una al sistema.
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

      <Tabs defaultValue="invitations" className="space-y-6">
        <TabsList>
          <TabsTrigger value="invitations">Invitaciones</TabsTrigger>
          <TabsTrigger value="users">Usuarios Activos</TabsTrigger>
        </TabsList>

        <TabsContent value="invitations" className="space-y-6">
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
                        <div className="flex space-x-2">
                          {invitation.status === 'pending' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyInvitationLink(invitation)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          )}
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
                        </div>
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
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Usuarios Activos</h3>
              <p className="text-sm text-gray-600 mt-1">Usuarios que ya han aceptado sus invitaciones</p>
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Fecha de Registro</TableHead>
                  <TableHead>Estado en Trabajadores</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeUsers?.map((user) => {
                  const isInCleaners = isUserInCleaners(user.user_id);
                  const canAddToCleaner = (user.role === 'cleaner' || user.role === 'admin') && !isInCleaners;
                  
                  return (
                    <TableRow key={user.user_id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-2 text-gray-400" />
                          {user.profiles.full_name || 'Sin nombre'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Mail className="h-4 w-4 mr-2 text-gray-400" />
                          {user.profiles.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {roleLabels[user.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString('es-ES')}
                      </TableCell>
                      <TableCell>
                        {(user.role === 'cleaner' || user.role === 'admin') && (
                          <div className="flex items-center">
                            <UserCheck className={`h-4 w-4 mr-2 ${isInCleaners ? 'text-green-600' : 'text-gray-400'}`} />
                            <span className={isInCleaners ? 'text-green-600' : 'text-gray-600'}>
                              {isInCleaners ? 'En lista de trabajadores' : 'No añadido'}
                            </span>
                          </div>
                        )}
                        {(user.role !== 'cleaner' && user.role !== 'admin') && (
                          <span className="text-gray-400">No aplicable</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          {canAddToCleaner && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddCleaner(user)}
                              disabled={addCleanerMutation.isPending}
                            >
                              <UserPlus className="h-4 w-4 mr-1" />
                              Añadir a Trabajadores
                            </Button>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción eliminará permanentemente al usuario "{user.profiles.email}" del sistema.
                                  {user.role === 'cleaner' && ' También será removido de la lista de trabajadores.'}
                                  Esta acción no se puede deshacer.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteUser(user.user_id)}
                                  className="bg-red-600 hover:bg-red-700"
                                  disabled={deleteUserMutation.isPending}
                                >
                                  Eliminar Usuario
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {activeUsers?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      No hay usuarios activos registrados
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};