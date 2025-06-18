
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { propertyGroupStorage } from '@/services/storage/propertyGroupStorage';
import { PropertyGroup, CleanerGroupAssignment, PropertyGroupAssignment } from '@/types/propertyGroups';
import { toast } from '@/hooks/use-toast';

export const usePropertyGroups = () => {
  return useQuery({
    queryKey: ['property-groups'],
    queryFn: () => propertyGroupStorage.getPropertyGroups(),
  });
};

export const useCreatePropertyGroup = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (group: Omit<PropertyGroup, 'id' | 'createdAt' | 'updatedAt'>) =>
      propertyGroupStorage.createPropertyGroup(group),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-groups'] });
      toast({
        title: "Grupo creado",
        description: "El grupo de propiedades se ha creado correctamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo crear el grupo de propiedades.",
        variant: "destructive",
      });
    },
  });
};

export const useUpdatePropertyGroup = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<PropertyGroup> }) =>
      propertyGroupStorage.updatePropertyGroup(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-groups'] });
      toast({
        title: "Grupo actualizado",
        description: "El grupo de propiedades se ha actualizado correctamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el grupo de propiedades.",
        variant: "destructive",
      });
    },
  });
};

export const useDeletePropertyGroup = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => propertyGroupStorage.deletePropertyGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-groups'] });
      toast({
        title: "Grupo eliminado",
        description: "El grupo de propiedades se ha eliminado correctamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo eliminar el grupo de propiedades.",
        variant: "destructive",
      });
    },
  });
};

export const usePropertyAssignments = (groupId: string) => {
  return useQuery({
    queryKey: ['property-assignments', groupId],
    queryFn: () => propertyGroupStorage.getPropertyAssignments(groupId),
    enabled: !!groupId,
  });
};

export const useCleanerAssignments = (groupId: string) => {
  return useQuery({
    queryKey: ['cleaner-assignments', groupId],
    queryFn: () => propertyGroupStorage.getCleanerAssignments(groupId),
    enabled: !!groupId,
  });
};

export const useAssignPropertyToGroup = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ groupId, propertyId }: { groupId: string; propertyId: string }) =>
      propertyGroupStorage.assignPropertyToGroup(groupId, propertyId),
    onSuccess: (_, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: ['property-assignments', groupId] });
      toast({
        title: "Propiedad asignada",
        description: "La propiedad se ha asignado al grupo correctamente.",
      });
    },
  });
};

export const useAssignCleanerToGroup = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (assignment: Omit<CleanerGroupAssignment, 'id' | 'createdAt' | 'updatedAt'>) =>
      propertyGroupStorage.assignCleanerToGroup(assignment),
    onSuccess: (_, assignment) => {
      queryClient.invalidateQueries({ queryKey: ['cleaner-assignments', assignment.propertyGroupId] });
      toast({
        title: "Trabajadora asignada",
        description: "La trabajadora se ha asignado al grupo correctamente.",
      });
    },
  });
};

export const useUpdateCleanerAssignment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates, groupId }: { id: string; updates: Partial<CleanerGroupAssignment>; groupId: string }) =>
      propertyGroupStorage.updateCleanerAssignment(id, updates),
    onSuccess: (_, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: ['cleaner-assignments', groupId] });
      toast({
        title: "Asignación actualizada",
        description: "La asignación de la trabajadora se ha actualizado correctamente.",
      });
    },
  });
};
