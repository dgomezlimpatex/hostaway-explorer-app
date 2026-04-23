
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
import { Card, CardContent } from "@/components/ui/card";
import { Edit, User, GripVertical, UserX, UserCheck } from "lucide-react";
import { Cleaner } from "@/types/calendar";
import { useDeleteCleaner, useUpdateCleanersOrder, useUpdateCleaner } from "@/hooks/useCleaners";
import { useIsMobile } from "@/hooks/use-mobile";
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
import { DeactivateWorkerDialog } from "./DeactivateWorkerDialog";

interface WorkersListProps {
  workers: Cleaner[];
  isLoading: boolean;
  onEditWorker: (worker: Cleaner) => void;
  onViewWorker: (worker: Cleaner) => void;
}

export const WorkersList = ({ workers, isLoading, onEditWorker, onViewWorker }: WorkersListProps) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [localWorkers, setLocalWorkers] = useState<Cleaner[]>(workers);
  const [workerToDeactivate, setWorkerToDeactivate] = useState<Cleaner | null>(null);
  const isMobile = useIsMobile();
  
  const deleteCleaner = useDeleteCleaner();
  const updateCleanersOrder = useUpdateCleanersOrder();
  const updateCleaner = useUpdateCleaner();

  React.useEffect(() => {
    setLocalWorkers(workers);
  }, [workers]);

  const handleDelete = (workerId: string) => {
    deleteCleaner.mutate(workerId);
  };

  const handleToggleActive = (worker: Cleaner) => {
    if (worker.isActive) {
      // Desactivar: abrir diálogo con conteo de tareas y opción de desasignar
      setWorkerToDeactivate(worker);
      return;
    }
    // Reactivar: directo
    updateCleaner.mutate({
      id: worker.id,
      updates: { isActive: true }
    });
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
    newWorkers.splice(draggedIndex, 1);
    newWorkers.splice(dropIndex, 0, draggedWorker);
    
    setLocalWorkers(newWorkers);
    setDraggedIndex(null);

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-2 text-muted-foreground">Cargando trabajadores...</p>
      </div>
    );
  }

  if (localWorkers.length === 0) {
    return (
      <div className="text-center py-8">
        <User className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-2 text-sm font-medium text-foreground">No hay trabajadores</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Comienza creando tu primer trabajador.
        </p>
      </div>
    );
  }

  // Mobile: card-based layout
  if (isMobile) {
    return (
      <>
      <div className="space-y-2">
        {localWorkers.map((worker) => (
          <Card 
            key={worker.id} 
            className={`${!worker.isActive ? 'opacity-60 bg-muted/50' : ''}`}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarImage src={worker.avatar || undefined} />
                  <AvatarFallback className="text-xs">
                    {worker.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0" onClick={() => onViewWorker(worker)}>
                  <div className="font-medium text-sm truncate">{worker.name}</div>
                  {worker.telefono && (
                    <div className="text-xs text-muted-foreground truncate">{worker.telefono}</div>
                  )}
                </div>
                <Badge variant={worker.isActive ? "default" : "secondary"} className="text-xs flex-shrink-0">
                  {worker.isActive ? "Activo" : "Inactivo"}
                </Badge>
              </div>
              <div className="flex items-center justify-end gap-1.5 mt-2 pt-2 border-t border-border">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onViewWorker(worker)}>
                  <User className="h-3 w-3 mr-1" />Ver
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onEditWorker(worker)}>
                  <Edit className="h-3 w-3 mr-1" />Editar
                </Button>
                {worker.isActive ? (
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleToggleActive(worker)}>
                    <UserX className="h-3 w-3" />
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleToggleActive(worker)}>
                    <UserCheck className="h-3 w-3" />
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="h-7 text-xs">
                      Eliminar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Estás seguro de eliminar?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción no se puede deshacer. Se eliminará permanentemente 
                        el trabajador "{worker.name}" y <strong>todas sus tareas asignadas quedarán sin asignar</strong>.
                        <br /><br />
                        💡 Si solo quieres que deje de aparecer en las asignaciones, usa <strong>"Desactivar"</strong> en su lugar.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(worker.id)}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        Eliminar definitivamente
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <DeactivateWorkerDialog
        worker={workerToDeactivate}
        open={!!workerToDeactivate}
        onOpenChange={(o) => { if (!o) setWorkerToDeactivate(null); }}
      />
      </>
    );
  }

  // Desktop: table layout
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
              className={`cursor-move transition-colors ${
                draggedIndex === index ? 'opacity-50' : ''
              } ${!worker.isActive ? 'opacity-60 bg-muted/50' : 'hover:bg-muted/30'}`}
            >
              <TableCell>
                <div className="flex items-center justify-center">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
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
                    <div className={`font-medium ${!worker.isActive ? 'text-muted-foreground' : ''}`}>{worker.name}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  {worker.email && (
                    <div className="text-sm text-muted-foreground">{worker.email}</div>
                  )}
                  {worker.telefono && (
                    <div className="text-sm text-muted-foreground">{worker.telefono}</div>
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
                  <Button variant="outline" size="sm" onClick={() => onViewWorker(worker)} className="flex items-center gap-1">
                    <User className="h-4 w-4" />Ver
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onEditWorker(worker)} className="flex items-center gap-1">
                    <Edit className="h-4 w-4" />Editar
                  </Button>
                  {worker.isActive ? (
                    <Button variant="outline" size="sm" onClick={() => handleToggleActive(worker)}
                      className="flex items-center gap-1 border-yellow-500 text-yellow-700 hover:bg-yellow-50">
                      <UserX className="h-4 w-4" />Desactivar
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => handleToggleActive(worker)}
                      className="flex items-center gap-1 border-green-500 text-green-700 hover:bg-green-50">
                      <UserCheck className="h-4 w-4" />Reactivar
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">Eliminar</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro de eliminar?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción no se puede deshacer. Se eliminará permanentemente 
                          el trabajador "{worker.name}" y <strong>todas sus tareas asignadas quedarán sin asignar</strong>.
                          <br /><br />
                          💡 Si solo quieres que deje de aparecer en las asignaciones, usa <strong>"Desactivar"</strong> en su lugar.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(worker.id)}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Eliminar definitivamente
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
    <DeactivateWorkerDialog
      worker={workerToDeactivate}
      open={!!workerToDeactivate}
      onOpenChange={(o) => { if (!o) setWorkerToDeactivate(null); }}
    />
    </>
  );
};
