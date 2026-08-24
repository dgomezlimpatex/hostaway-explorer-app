import React, { useMemo, useState } from 'react';
import { useInvitations, useCreateInvitation, useRevokeInvitation } from '@/hooks/useInvitations';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCleaners } from '@/hooks/useCleaners';
import { useSedes } from '@/hooks/useSedes';
import { useAuth } from '@/hooks/useAuth';
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
import { UserPlus, Mail, Clock, CheckCircle, XCircle, AlertTriangle, Copy, ArrowLeft, Users, Trash2, UserCheck, Search, Building2, ShieldCheck, Check, Info, KeyRound } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';

type AppRole = Database['public']['Enums']['app_role'];

type UserRoleAssignment = {
  id: string;
  role: AppRole;
  created_at: string;
};

type ActiveUserRow = {
  user_id: string;
  roles: UserRoleAssignment[];
  primaryRole: AppRole;
  created_at: string;
  profiles: {
    email: string;
    full_name?: string | null;
  };
};

type UserSedeAccessRow = {
  user_id: string;
  sede_id: string;
  can_access: boolean;
  sedes?: {
    id: string;
    nombre: string;
    codigo: string;
    ciudad: string;
  } | null;
};

type InvitationRow = {
  invitation_token: string;
  email: string;
};

const roleLabels: Record<AppRole, string> = {
  admin: 'Administrador',
  manager: 'Manager',
  supervisor: 'Supervisor',
  cleaner: 'Limpiador',
  client: 'Cliente',
  logistics: 'Logística',
};

const roleDescriptions: Record<AppRole, string> = {
  admin: 'Acceso completo y administración de usuarios.',
  manager: 'Gestión operativa, trabajadores y clientes.',
  supervisor: 'Supervisión de tareas y control operativo.',
  cleaner: 'Acceso a tareas y partes de limpieza asignados.',
  client: 'Acceso limitado al portal de cliente.',
  logistics: 'Gestión de inventario y logística.',
};

const rolePriority: Record<AppRole, number> = {
  admin: 1,
  manager: 2,
  supervisor: 3,
  cleaner: 4,
  client: 5,
  logistics: 6,
};

const roleOptions = Object.keys(roleLabels) as AppRole[];

const getPrimaryRole = (roles: UserRoleAssignment[]): AppRole => (
  [...roles].sort((a, b) => rolePriority[a.role] - rolePriority[b.role])[0]?.role || 'client'
);

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
  const [sedeId, setSedeId] = useState<string>('');
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<AppRole | 'all'>('all');
  const [roleManagerUserId, setRoleManagerUserId] = useState<string | null>(null);
  const [draftRoles, setDraftRoles] = useState<AppRole[]>([]);
  const [sedeManagerUserId, setSedeManagerUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user: currentUser, userRole: currentUserRole } = useAuth();
  const queryClient = useQueryClient();

  const { data: invitations, isLoading } = useInvitations();
  const { cleaners } = useCleaners();
  const { allSedes, grantSedeAccess, revokeSedeAccess, isGrantingAccess, isRevokingAccess } = useSedes();
  const createInvitation = useCreateInvitation();
  const revokeInvitation = useRevokeInvitation();

  // Query para obtener usuarios activos con todos sus roles
  const { data: activeUsers, isLoading: isLoadingUsers } = useQuery<ActiveUserRow[]>({
    queryKey: ['active-users'],
    queryFn: async () => {
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('id, user_id, role, created_at')
        .order('created_at', { ascending: true });

      if (rolesError) throw rolesError;
      if (!userRoles?.length) return [];

      const userIds = [...new Set(userRoles.map((userRole) => userRole.user_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      const groupedUsers = new Map<string, ActiveUserRow>();
      userRoles.forEach((userRole) => {
        const existingUser = groupedUsers.get(userRole.user_id);
        const profile = profiles?.find((item) => item.id === userRole.user_id) || { email: '', full_name: '' };
        const roleAssignment: UserRoleAssignment = {
          id: userRole.id,
          role: userRole.role,
          created_at: userRole.created_at,
        };

        if (existingUser) {
          existingUser.roles.push(roleAssignment);
          existingUser.primaryRole = getPrimaryRole(existingUser.roles);
          return;
        }

        groupedUsers.set(userRole.user_id, {
          user_id: userRole.user_id,
          roles: [roleAssignment],
          primaryRole: userRole.role,
          created_at: userRole.created_at,
          profiles: {
            email: profile.email || '',
            full_name: profile.full_name,
          },
        });
      });

      return [...groupedUsers.values()].map((user) => ({
        ...user,
        primaryRole: getPrimaryRole(user.roles),
        roles: [...user.roles].sort((a, b) => rolePriority[a.role] - rolePriority[b.role]),
      }));
    },
  });

  const userRoleMutation = useMutation({
    mutationFn: async ({
      userId,
      currentRoles,
      nextRoles,
    }: {
      userId: string;
      currentRoles: UserRoleAssignment[];
      nextRoles: AppRole[];
    }) => {
      if (nextRoles.length === 0) {
        throw new Error('Un usuario debe conservar al menos un rol.');
      }

      const currentRoleSet = new Set(currentRoles.map((item) => item.role));
      const nextRoleSet = new Set(nextRoles);
      const rolesToAdd = nextRoles.filter((item) => !currentRoleSet.has(item));
      const roleIdsToRemove = currentRoles
        .filter((item) => !nextRoleSet.has(item.role))
        .map((item) => item.id);

      if (rolesToAdd.length > 0) {
        const { error } = await supabase
          .from('user_roles')
          .insert(rolesToAdd.map((newRole) => ({ user_id: userId, role: newRole })));
        if (error) throw error;
      }

      if (roleIdsToRemove.length > 0) {
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .in('id', roleIdsToRemove);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-users'] });
      setRoleManagerUserId(null);
      toast({ title: 'Roles actualizados', description: 'La combinación de permisos se ha guardado.' });
    },
    onError: (error) => {
      console.error('Error updating user roles:', error);
      queryClient.invalidateQueries({ queryKey: ['active-users'] });
      toast({ title: 'No se pudieron actualizar los roles', description: error instanceof Error ? error.message : 'Revisa tus permisos e inténtalo de nuevo.', variant: 'destructive' });
    },
  });

  // Query para obtener asignaciones de sede de usuarios
  const { data: userSedeAccess, isLoading: isLoadingSedeAccess } = useQuery<UserSedeAccessRow[]>({
    queryKey: ['user-sede-access'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_sede_access')
        .select(`
          user_id,
          sede_id,
          can_access,
          sedes (
            id,
            nombre,
            codigo,
            ciudad
          )
        `)
        .eq('can_access', true);
      
      if (error) throw error;
      return data || [];
    }
  });

  // Mutation para añadir cleaner (usa upsert para evitar conflictos si ya existe)
  const addCleanerMutation = useMutation({
    mutationFn: async ({ userId, email, name, sedeId }: { userId: string; email: string; name: string; sedeId: string }) => {
      const { data: cleanerData, error } = await supabase
        .from('cleaners')
        .upsert({
          user_id: userId,
          name: name || email,
          email,
          is_active: true,
          sede_id: sedeId
        }, {
          onConflict: 'user_id'
        })
        .select('id')
        .single();
      
      if (error) throw error;

      // Create full availability (all days, 06:00-23:00)
      if (cleanerData?.id) {
        const availabilityRecords = Array.from({ length: 7 }, (_, dayOfWeek) => ({
          cleaner_id: cleanerData.id,
          day_of_week: dayOfWeek,
          is_available: true,
          start_time: '06:00',
          end_time: '23:00',
        }));
        
        const { error: availError } = await supabase.from('cleaner_availability').upsert(availabilityRecords, {
          onConflict: 'cleaner_id,day_of_week',
          ignoreDuplicates: true,
        });
        if (availError) {
          console.error('Error creating availability records:', availError);
        }
      }
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
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No tienes sesión activa');
      }

      const response = await fetch('https://qyipyygojlfhdghnraus.supabase.co/functions/v1/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al eliminar usuario');
      }

      return await response.json();
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
    
    // Validar que si el rol es cleaner, debe tener sede_id
    if (role === 'cleaner' && !sedeId) {
      toast({
        title: 'Error',
        description: 'Para invitar un limpiador debe seleccionar una sede',
        variant: 'destructive',
      });
      return;
    }

    createInvitation.mutate(
      { 
        email: email.trim(), 
        role, 
        sede_id: sedeId || undefined
      },
      {
        onSuccess: () => {
          setEmail('');
          setRole('cleaner');
          setSedeId('');
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

  const handleAddCleaner = (user: ActiveUserRow) => {
    // Get the sede assigned to this user (from their invitation or user_sede_access)
    const userSedes = getUserAssignedSedes(user.user_id);
    
    // Use the user's assigned sede, or fall back to first available sede
    let targetSedeId: string | undefined;
    
    if (userSedes.length > 0) {
      // Use the first sede the user has access to
      targetSedeId = userSedes[0].sede_id;
    } else if (allSedes && allSedes.length > 0) {
      // Fallback to first available sede if user has no assigned sedes
      targetSedeId = allSedes[0]?.id;
    }

    if (!targetSedeId) {
      toast({
        title: 'Error',
        description: 'No hay sedes disponibles para asignar al trabajador.',
        variant: 'destructive',
      });
      return;
    }

    addCleanerMutation.mutate({
      userId: user.user_id,
      email: user.profiles.email,
      name: user.profiles.full_name || user.profiles.email,
      sedeId: targetSedeId
    });
  };

  const handleDeleteUser = (userId: string) => {
    if (userId === currentUser?.id) {
      toast({ title: 'No puedes eliminar tu propia cuenta', description: 'Usa otra cuenta administradora para realizar esta acción.', variant: 'destructive' });
      return;
    }
    deleteUserMutation.mutate(userId);
  };

  const isUserInCleaners = (userId: string) => {
    return cleaners?.some(cleaner => cleaner.user_id === userId);
  };

  // Helper para obtener sedes asignadas a un usuario
  const getUserAssignedSedes = (userId: string) => (
    userSedeAccess?.filter((access) => access.user_id === userId && access.can_access) || []
  );

  // Helper para verificar si un usuario tiene acceso a una sede específica
  const hasSedeAccess = (userId: string, sedeId: string) => (
    userSedeAccess?.some((access) => (
      access.user_id === userId && access.sede_id === sedeId && access.can_access
    )) || false
  );

  const filteredActiveUsers = useMemo(() => {
    const normalizedSearch = userSearch.trim().toLowerCase();
    return (activeUsers || []).filter((user) => {
      const matchesRole = roleFilter === 'all' || user.roles.some((item) => item.role === roleFilter);
      const matchesSearch = !normalizedSearch
        || user.profiles.email.toLowerCase().includes(normalizedSearch)
        || (user.profiles.full_name || '').toLowerCase().includes(normalizedSearch);
      return matchesRole && matchesSearch;
    });
  }, [activeUsers, roleFilter, userSearch]);

  const roleManagerUser = activeUsers?.find((user) => user.user_id === roleManagerUserId);
  const sedeManagerUser = activeUsers?.find((user) => user.user_id === sedeManagerUserId);
  const canEditRoles = currentUserRole === 'admin';
  const canEditSedes = currentUserRole === 'admin' || currentUserRole === 'manager';

  const isUserAdmin = (userId: string) => (
    activeUsers?.some((user) => user.user_id === userId && user.roles.some((item) => item.role === 'admin')) || false
  );

  const openRoleManager = (user: ActiveUserRow) => {
    if (!canEditRoles) {
      toast({ title: 'Solo administradores', description: 'La asignación de roles requiere una cuenta administradora.', variant: 'destructive' });
      return;
    }
    setRoleManagerUserId(user.user_id);
    setDraftRoles(user.roles.map((item) => item.role));
  };

  const handleSaveRoles = () => {
    if (!roleManagerUser || draftRoles.length === 0) {
      toast({ title: 'Debe conservar al menos un rol', description: 'No se puede guardar un usuario sin permisos.', variant: 'destructive' });
      return;
    }

    const adminCount = (activeUsers || []).filter((user) => isUserAdmin(user.user_id)).length;
    const removesOnlyAdmin = isUserAdmin(roleManagerUser.user_id)
      && !draftRoles.includes('admin')
      && adminCount <= 1;

    if (removesOnlyAdmin) {
      toast({ title: 'No se puede retirar el último administrador', description: 'Asigna primero el rol de administrador a otra persona.', variant: 'destructive' });
      return;
    }

    userRoleMutation.mutate({
      userId: roleManagerUser.user_id,
      currentRoles: roleManagerUser.roles,
      nextRoles: draftRoles,
    });
  };

  const handleOpenSedeManager = (user: ActiveUserRow) => {
    if (!canEditSedes) {
      toast({ title: 'Sin permiso para editar sedes', description: 'Tu cuenta puede consultar la pantalla, pero no modificar accesos.', variant: 'destructive' });
      return;
    }
    setSedeManagerUserId(user.user_id);
  };

  // Las mutaciones del hook son asíncronas: refrescar después de terminar evita que la tabla muestre datos antiguos.
  const handleGrantSedeAccess = (userId: string, sedeId: string) => {
    grantSedeAccess(
      { userId, sedeId },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-sede-access'] }) },
    );
  };

  const handleRevokeSedeAccess = (userId: string, sedeId: string) => {
    revokeSedeAccess(
      { userId, sedeId },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-sede-access'] }) },
    );
  };

  const copyInvitationLink = (invitation: InvitationRow) => {
    const appUrl = window.location.origin;
    const invitationUrl = `${appUrl}/accept-invitation?token=${invitation.invitation_token}&email=${encodeURIComponent(invitation.email)}`;
    
    navigator.clipboard.writeText(invitationUrl).then(() => {
      toast({
        title: 'Enlace copiado',
        description: 'El enlace de invitación se ha copiado al portapapeles.',
      });
    });
  };

  if (isLoading || isLoadingUsers || isLoadingSedeAccess) {
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
                <Select value={role} onValueChange={(value: AppRole) => {
                  setRole(value);
                  // Solo admin no necesita sede específica
                  if (value === 'admin') {
                    setSedeId('');
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="cleaner">Limpiador</SelectItem>
                    <SelectItem value="logistics">Logística</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {role !== 'admin' && (
                <div className="space-y-2">
                  <Label htmlFor="sede">
                    Sede {role === 'cleaner' ? '(Requerido)' : '(Opcional)'}
                  </Label>
                  <Select value={sedeId} onValueChange={setSedeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una sede" />
                    </SelectTrigger>
                    <SelectContent>
                      {allSedes?.map((sede) => (
                        <SelectItem key={sede.id} value={sede.id}>
                          {sede.nombre} ({sede.codigo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {role !== 'cleaner' && (
                    <p className="text-sm text-muted-foreground">
                      Si no seleccionas una sede, el usuario tendrá acceso a todas las sedes.
                    </p>
                  )}
                </div>
              )}
              
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

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4 shadow-sm"><p className="text-sm text-gray-500">Usuarios activos</p><p className="mt-1 text-2xl font-semibold text-gray-900">{activeUsers?.length || 0}</p></div>
        <div className="rounded-xl border bg-white p-4 shadow-sm"><p className="text-sm text-gray-500">Administradores y managers</p><p className="mt-1 text-2xl font-semibold text-gray-900">{activeUsers?.filter((user) => user.roles.some((item) => item.role === 'admin' || item.role === 'manager')).length || 0}</p></div>
        <div className="rounded-xl border bg-white p-4 shadow-sm"><p className="text-sm text-gray-500">Sedes disponibles</p><p className="mt-1 text-2xl font-semibold text-gray-900">{allSedes?.length || 0}</p></div>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
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
                  const canRevoke = invitation.status === 'pending'; // Allow revoking even if expired
                  
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
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Usuarios Activos</h3>
                  <p className="text-sm text-gray-600 mt-1">Consulta el acceso de cada persona y edita roles o sedes sin salir de esta pantalla.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Buscar usuarios" className="pl-9 sm:w-64" />
                  </div>
                  <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as AppRole | 'all')}>
                    <SelectTrigger className="sm:w-44"><SelectValue placeholder="Todos los roles" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los roles</SelectItem>
                      {roleOptions.map((key) => <SelectItem key={key} value={key}>{roleLabels[key]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[220px]">Usuario</TableHead>
                    <TableHead className="min-w-[220px]">Roles</TableHead>
                    <TableHead className="min-w-[230px]">Sedes con acceso</TableHead>
                    <TableHead className="min-w-[180px]">Trabajadores</TableHead>
                    <TableHead className="min-w-[280px] text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredActiveUsers.map((user) => {
                    const userSedes = getUserAssignedSedes(user.user_id);
                    const hasGlobalSedeAccess = isUserAdmin(user.user_id);
                    const hasCleanerRole = user.roles.some((item) => item.role === 'cleaner' || item.role === 'admin');
                    const isInCleaners = isUserInCleaners(user.user_id);
                    const canAddToCleaner = hasCleanerRole && !isInCleaners;

                    return (
                      <TableRow key={user.user_id} className="align-top">
                        <TableCell>
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 rounded-full bg-[#eee8ff] p-2 text-[#310984]"><Users className="h-4 w-4" /></div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900">{user.profiles.full_name || 'Sin nombre'}</p>
                              <p className="mt-1 flex items-center gap-1 text-sm text-gray-500"><Mail className="h-3.5 w-3.5" />{user.profiles.email}</p>
                              <p className="mt-1 text-xs text-gray-400">Alta: {new Date(user.created_at).toLocaleDateString('es-ES')}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-1.5">
                              {user.roles.map((assignment) => (
                                <Badge key={assignment.id} variant={assignment.role === user.primaryRole ? 'default' : 'secondary'} className="text-xs">
                                  {roleLabels[assignment.role]}
                                  {assignment.role === user.primaryRole && <span className="ml-1 opacity-75">· principal</span>}
                                </Badge>
                              ))}
                            </div>
                            <p className="flex items-start gap-1 text-xs text-gray-500"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />El rol principal determina el menú y los permisos actuales.</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {hasGlobalSedeAccess ? (
                            <div className="space-y-1"><Badge className="bg-violet-100 text-violet-800 hover:bg-violet-100">Todas las sedes</Badge><p className="text-xs text-gray-500">Por tener rol de administrador</p></div>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-1.5">
                                {userSedes.slice(0, 3).map((access) => <Badge key={access.sede_id} variant="outline" className="text-xs">{access.sedes?.nombre || access.sede_id}</Badge>)}
                                {userSedes.length > 3 && <Badge variant="secondary" className="text-xs">+{userSedes.length - 3}</Badge>}
                                {userSedes.length === 0 && <span className="text-sm font-medium text-amber-700">Sin sedes asignadas</span>}
                              </div>
                              {userSedes.length === 0 && <p className="text-xs text-amber-700">No podrá ver trabajo de ninguna sede.</p>}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {hasCleanerRole ? (
                            <div className="flex items-center gap-2">
                              <UserCheck className={`h-4 w-4 ${isInCleaners ? 'text-emerald-600' : 'text-gray-400'}`} />
                              <span className={isInCleaners ? 'text-sm text-emerald-700' : 'text-sm text-gray-600'}>{isInCleaners ? 'En lista de trabajadores' : 'No añadido'}</span>
                            </div>
                          ) : <span className="text-sm text-gray-400">No aplicable</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => openRoleManager(user)} disabled={!canEditRoles || userRoleMutation.isPending} title={!canEditRoles ? 'Solo un administrador puede cambiar roles' : 'Añadir o quitar roles'}>
                              <ShieldCheck className="mr-1.5 h-4 w-4" /> Roles
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleOpenSedeManager(user)} disabled={!canEditSedes || isGrantingAccess || isRevokingAccess} title={!canEditSedes ? 'No tienes permiso para editar sedes' : 'Gestionar sedes'}>
                              <Building2 className="mr-1.5 h-4 w-4" /> Sedes
                            </Button>
                            {canAddToCleaner && <Button variant="outline" size="sm" onClick={() => handleAddCleaner(user)} disabled={addCleanerMutation.isPending}><UserPlus className="mr-1.5 h-4 w-4" /> Trabajador</Button>}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" disabled={user.user_id === currentUser?.id} title={user.user_id === currentUser?.id ? 'No puedes eliminar tu propia cuenta' : 'Eliminar usuario'}><Trash2 className="h-4 w-4" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
                                  <AlertDialogDescription>Se eliminará permanentemente <strong>{user.profiles.email}</strong> y sus permisos. Esta acción no se puede deshacer.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteUser(user.user_id)} className="bg-red-600 hover:bg-red-700" disabled={deleteUserMutation.isPending}>Eliminar usuario</AlertDialogAction></AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredActiveUsers.length === 0 && <TableRow><TableCell colSpan={5} className="py-12 text-center text-gray-500">No hay usuarios que coincidan con los filtros.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </div>
          <Dialog open={!!roleManagerUserId} onOpenChange={(open) => !open && setRoleManagerUserId(null)}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-[#310984]" />Gestionar roles</DialogTitle>
                <DialogDescription>
                  {roleManagerUser?.profiles.full_name || roleManagerUser?.profiles.email}. Puedes combinar varios roles; el principal se elige automáticamente por prioridad.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-lg border border-violet-100 bg-violet-50 p-3 text-sm text-violet-900"><Info className="mr-2 inline h-4 w-4" />Los permisos de la aplicación actual se basan en el rol marcado como principal.</div>
              <div className="max-h-[52vh] space-y-2 overflow-y-auto py-1">
                {roleOptions.map((roleOption) => {
                  const isSelected = draftRoles.includes(roleOption);
                  const isPrimary = roleManagerUser?.primaryRole === roleOption;
                  return (
                    <label key={roleOption} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${isSelected ? 'border-[#310984] bg-[#faf8ff]' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <Checkbox checked={isSelected} onCheckedChange={(checked) => setDraftRoles((current) => checked ? [...new Set([...current, roleOption])] : current.filter((item) => item !== roleOption))} disabled={userRoleMutation.isPending} aria-label={`Asignar rol ${roleLabels[roleOption]}`} />
                      <span className="min-w-0 flex-1"><span className="flex items-center gap-2 font-medium text-gray-900">{roleLabels[roleOption]}{isPrimary && <Badge variant="secondary" className="text-[10px]">Principal</Badge>}</span><span className="mt-1 block text-xs text-gray-500">{roleDescriptions[roleOption]}</span></span>
                      {isSelected && <Check className="mt-0.5 h-4 w-4 text-[#310984]" />}
                    </label>
                  );
                })}
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setRoleManagerUserId(null)}>Cancelar</Button><Button onClick={handleSaveRoles} disabled={userRoleMutation.isPending || draftRoles.length === 0}>{userRoleMutation.isPending ? 'Guardando...' : 'Guardar roles'}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={!!sedeManagerUserId} onOpenChange={(open) => !open && setSedeManagerUserId(null)}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-[#310984]" />Gestionar sedes</DialogTitle>
                <DialogDescription>{sedeManagerUser?.profiles.full_name || sedeManagerUser?.profiles.email}. Marca las sedes a las que podrá acceder.</DialogDescription>
              </DialogHeader>
              {sedeManagerUserId && isUserAdmin(sedeManagerUserId) ? (
                <div className="rounded-lg border border-violet-100 bg-violet-50 p-4 text-sm text-violet-900"><ShieldCheck className="mr-2 inline h-4 w-4" /><strong>Acceso global:</strong> los administradores pueden acceder automáticamente a todas las sedes activas. No necesitas marcar ninguna.</div>
              ) : (
                <>
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"><span className="text-gray-600">Sedes asignadas</span><strong className="text-gray-900">{sedeManagerUserId ? getUserAssignedSedes(sedeManagerUserId).length : 0} de {allSedes?.length || 0}</strong></div>
                  <div className="max-h-[52vh] space-y-2 overflow-y-auto py-1">
                    {allSedes?.map((sede) => (
                      <label key={sede.id} className="flex cursor-pointer items-center justify-between rounded-xl border border-gray-200 p-3 transition-colors hover:border-[#310984] hover:bg-[#faf8ff]">
                        <span><span className="block font-medium text-gray-900">{sede.nombre}</span><span className="text-xs text-gray-500">{sede.codigo} · {sede.ciudad}</span></span>
                        <Checkbox checked={sedeManagerUserId ? hasSedeAccess(sedeManagerUserId, sede.id) : false} onCheckedChange={(checked) => sedeManagerUserId && (checked ? handleGrantSedeAccess(sedeManagerUserId, sede.id) : handleRevokeSedeAccess(sedeManagerUserId, sede.id))} disabled={isGrantingAccess || isRevokingAccess} aria-label={`Dar acceso a ${sede.nombre}`} />
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500"><Info className="mr-1 inline h-3.5 w-3.5" />Los cambios de sede se guardan al marcar o desmarcar una opción.</p>
                </>
              )}
              <DialogFooter><Button onClick={() => setSedeManagerUserId(null)}>Cerrar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
};
