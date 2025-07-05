
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Edit, Calendar, Clock, User, GripVertical } from "lucide-react";
import { Cleaner } from "@/types/calendar";
import { useDeleteCleaner, useUpdateCleanersOrder } from "@/hooks/useCleaners";
import { AvailabilityModal } from './AvailabilityModal';
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
} from "@/components/ui/alert-dialog";

interface WorkersListProps {
  workers: Cleaner[];
  isLoading: boolean;
  onEditWorker: (worker: Cleaner) => void;
  onViewWorker: (worker: Cleaner) => void;
}

export const WorkersList = ({ workers, isLoading, onEditWorker, onViewWorker }: WorkersListProps) => {
  const [availabilityWorker, setAvailabilityWorker] = useState<Cleaner | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [localWorkers, setLocalWorkers] = useState<Cleaner[]>(workers);
  
  const deleteCleaner = useDeleteCleaner();
  const updateCleanersOrder = useUpdateCleanersOrder();

  // Sincronizar workers locales cuando cambien los props
  React.useEffect(() => {
    setLocalWorkers(workers);
  }, [workers]);

  const handleDelete = (workerId: string) => {
    deleteCleaner.mutate(workerId);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const newWorkers = [...localWorkers];
    const draggedWorker = newWorkers[draggedIndex];
    
    // Remover el elemento arrastrado
    newWorkers.splice(draggedIndex, 1);
    
    // Insertar en la nueva posición
    newWorkers.splice(dropIndex, 0, draggedWorker);
    
    setLocalWorkers(newWorkers);
    setDraggedIndex(null);

    // Actualizar el orden en la base de datos
    const orderUpdates = newWorkers.map((worker, index) => ({
      id: worker.id,
      sortOrder: index
    }));
    
    updateCleanersOrder.mutate(orderUpdates);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-2 text-gray-600">Cargando trabajadores...</p>
      </div>
    );
  }

  if (localWorkers.length === 0) {
    return (
      <div className="text-center py-8">
        <User className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No hay trabajadores</h3>
        <p className="mt-1 text-sm text-gray-500">
          Comienza creando tu primer trabajador.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Trabajador</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {localWorkers.map((worker, index) => (
              <TableRow 
                key={worker.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`cursor-move hover:bg-gray-50 transition-colors ${
                  draggedIndex === index ? 'opacity-50' : ''
                }`}
              >
                <TableCell>
                  <div className="flex items-center justify-center">
                    <GripVertical className="h-4 w-4 text-gray-400" />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={worker.avatar || undefined} />
                      <AvatarFallback>
                        {worker.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{worker.name}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {worker.email && (
                      <div className="text-sm text-gray-600">{worker.email}</div>
                    )}
                    {worker.telefono && (
                      <div className="text-sm text-gray-600">{worker.telefono}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={worker.isActive ? "default" : "secondary"}>
                    {worker.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewWorker(worker)}
                      className="flex items-center gap-1"
                    >
                      <User className="h-4 w-4" />
                      Ver Detalles
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAvailabilityWorker(worker)}
                      className="flex items-center gap-1"
                    >
                      <Clock className="h-4 w-4" />
                      Disponibilidad
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEditWorker(worker)}
                      className="flex items-center gap-1"
                    >
                      <Edit className="h-4 w-4" />
                      Editar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          Eliminar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción no se puede deshacer. Se eliminará permanentemente 
                            el trabajador "{worker.name}" y todos sus datos asociados.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(worker.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AvailabilityModal
        worker={availabilityWorker}
        open={!!availabilityWorker}
        onOpenChange={(open) => !open && setAvailabilityWorker(null)}
      />
    </>
  );
};
