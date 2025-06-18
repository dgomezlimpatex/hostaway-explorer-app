
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAssignCleanerToGroup, useUpdateCleanerAssignment } from '@/hooks/usePropertyGroups';
import { PropertyGroup, CleanerGroupAssignment } from '@/types/propertyGroups';
import { Cleaner } from '@/types/calendar';
import { Plus, User, Edit, Crown, Users, Clock } from 'lucide-react';
import { propertyGroupStorage } from '@/services/storage/propertyGroupStorage';
import { toast } from '@/hooks/use-toast';

interface CleanerAssignmentSectionProps {
  group: PropertyGroup;
  cleanerAssignments: CleanerGroupAssignment[];
  allCleaners: Cleaner[];
}

export const CleanerAssignmentSection = ({ 
  group, 
  cleanerAssignments, 
  allCleaners 
}: CleanerAssignmentSectionProps) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<CleanerGroupAssignment | null>(null);
  const [formData, setFormData] = useState({
    cleanerId: '',
    priority: 1,
    maxTasksPerDay: 8,
    estimatedTravelTimeMinutes: 15,
    isActive: true,
  });

  const assignCleaner = useAssignCleanerToGroup();
  const updateAssignment = useUpdateCleanerAssignment();

  const availableCleaners = allCleaners.filter(c => 
    !cleanerAssignments.some(ca => ca.cleanerId === c.id) && c.isActive
  );

  const handleAddCleaner = async () => {
    try {
      await assignCleaner.mutateAsync({
        propertyGroupId: group.id,
        cleanerId: formData.cleanerId,
        priority: formData.priority,
        maxTasksPerDay: formData.maxTasksPerDay,
        estimatedTravelTimeMinutes: formData.estimatedTravelTimeMinutes,
        isActive: formData.isActive,
      });
      setIsAddModalOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error adding cleaner:', error);
    }
  };

  const handleEditAssignment = (assignment: CleanerGroupAssignment) => {
    setEditingAssignment(assignment);
    setFormData({
      cleanerId: assignment.cleanerId,
      priority: assignment.priority,
      maxTasksPerDay: assignment.maxTasksPerDay,
      estimatedTravelTimeMinutes: assignment.estimatedTravelTimeMinutes,
      isActive: assignment.isActive,
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateAssignment = async () => {
    if (!editingAssignment) return;

    try {
      await updateAssignment.mutateAsync({
        id: editingAssignment.id,
        updates: {
          priority: formData.priority,
          maxTasksPerDay: formData.maxTasksPerDay,
          estimatedTravelTimeMinutes: formData.estimatedTravelTimeMinutes,
          isActive: formData.isActive,
        },
        groupId: group.id,
      });
      setIsEditModalOpen(false);
      setEditingAssignment(null);
      resetForm();
    } catch (error) {
      console.error('Error updating assignment:', error);
    }
  };

  const handleRemoveCleaner = async (assignmentId: string) => {
    try {
      await propertyGroupStorage.removeCleanerFromGroup(assignmentId);
      toast({
        title: "Trabajadora eliminada",
        description: "La trabajadora se ha eliminado del grupo correctamente.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar la trabajadora del grupo.",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      cleanerId: '',
      priority: 1,
      maxTasksPerDay: 8,
      estimatedTravelTimeMinutes: 15,
      isActive: true,
    });
  };

  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 1: return 'Principal';
      case 2: return 'Secundaria';
      case 3: return 'Terciaria';
      default: return `Prioridad ${priority}`;
    }
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return 'bg-yellow-100 text-yellow-800';
      case 2: return 'bg-blue-100 text-blue-800';
      case 3: return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const sortedAssignments = [...cleanerAssignments].sort((a, b) => a.priority - b.priority);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Personal Asignado</h3>
        <Button onClick={() => setIsAddModalOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Asignar Personal
        </Button>
      </div>

      {sortedAssignments.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No hay personal asignado a este grupo</p>
            <p className="text-sm">Asigna trabajadoras para habilitar la asignación automática</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedAssignments.map((assignment) => {
            const cleaner = allCleaners.find(c => c.id === assignment.cleanerId);
            if (!cleaner) return null;

            return (
              <Card key={assignment.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        {assignment.priority === 1 ? (
                          <Crown className="h-5 w-5 text-yellow-600" />
                        ) : (
                          <User className="h-5 w-5 text-gray-600" />
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-gray-900">{cleaner.name}</h4>
                          <Badge className={getPriorityColor(assignment.priority)}>
                            {getPriorityLabel(assignment.priority)}
                          </Badge>
                          {!assignment.isActive && (
                            <Badge className="bg-red-100 text-red-800">Inactiva</Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>Máx. {assignment.maxTasksPerDay} tareas/día</span>
                          </div>
                          <div>
                            <span>Tiempo viaje: {assignment.estimatedTravelTimeMinutes}min</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditAssignment(assignment)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveCleaner(assignment.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Cleaner Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={(open) => {
        setIsAddModalOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Asignar Personal al Grupo</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="cleaner">Trabajadora</Label>
              <Select value={formData.cleanerId} onValueChange={(value) => setFormData({ ...formData, cleanerId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una trabajadora" />
                </SelectTrigger>
                <SelectContent>
                  {availableCleaners.map((cleaner) => (
                    <SelectItem key={cleaner.id} value={cleaner.id}>
                      {cleaner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="priority">Prioridad</Label>
              <Select value={formData.priority.toString()} onValueChange={(value) => setFormData({ ...formData, priority: parseInt(value) })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Principal</SelectItem>
                  <SelectItem value="2">2 - Secundaria</SelectItem>
                  <SelectItem value="3">3 - Terciaria</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="maxTasks">Máximo tareas por día</Label>
              <Input
                id="maxTasks"
                type="number"
                min="1"
                max="20"
                value={formData.maxTasksPerDay}
                onChange={(e) => setFormData({ ...formData, maxTasksPerDay: parseInt(e.target.value) || 8 })}
              />
            </div>

            <div>
              <Label htmlFor="travelTime">Tiempo estimado entre propiedades (minutos)</Label>
              <Input
                id="travelTime"
                type="number"
                min="5"
                max="60"
                value={formData.estimatedTravelTimeMinutes}
                onChange={(e) => setFormData({ ...formData, estimatedTravelTimeMinutes: parseInt(e.target.value) || 15 })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="isActive">Activa</Label>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleAddCleaner}
                disabled={!formData.cleanerId || assignCleaner.isPending}
              >
                Asignar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Assignment Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={(open) => {
        setIsEditModalOpen(open);
        if (!open) {
          setEditingAssignment(null);
          resetForm();
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Asignación</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-priority">Prioridad</Label>
              <Select value={formData.priority.toString()} onValueChange={(value) => setFormData({ ...formData, priority: parseInt(value) })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Principal</SelectItem>
                  <SelectItem value="2">2 - Secundaria</SelectItem>
                  <SelectItem value="3">3 - Terciaria</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="edit-maxTasks">Máximo tareas por día</Label>
              <Input
                id="edit-maxTasks"
                type="number"
                min="1"
                max="20"
                value={formData.maxTasksPerDay}
                onChange={(e) => setFormData({ ...formData, maxTasksPerDay: parseInt(e.target.value) || 8 })}
              />
            </div>

            <div>
              <Label htmlFor="edit-travelTime">Tiempo estimado entre propiedades (minutos)</Label>
              <Input
                id="edit-travelTime"
                type="number"
                min="5"
                max="60"
                value={formData.estimatedTravelTimeMinutes}
                onChange={(e) => setFormData({ ...formData, estimatedTravelTimeMinutes: parseInt(e.target.value) || 15 })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="edit-isActive">Activa</Label>
              <Switch
                id="edit-isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleUpdateAssignment}
                disabled={updateAssignment.isPending}
              >
                Actualizar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
