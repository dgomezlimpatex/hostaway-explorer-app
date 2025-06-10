
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Edit, Trash2, User, Mail, Phone } from "lucide-react";
import { Cleaner } from "@/types/calendar";
import { useDeleteCleaner } from "@/hooks/useCleaners";
import { useToast } from "@/hooks/use-toast";

interface WorkersListProps {
  workers: Cleaner[];
  isLoading: boolean;
  onEditWorker: (worker: Cleaner) => void;
}

export const WorkersList = ({ workers, isLoading, onEditWorker }: WorkersListProps) => {
  const deleteCleaner = useDeleteCleaner();
  const { toast } = useToast();

  const handleDeleteWorker = (worker: Cleaner) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar a ${worker.name}?`)) {
      deleteCleaner.mutate(worker.id, {
        onSuccess: () => {
          toast({
            title: "Trabajador eliminado",
            description: `${worker.name} ha sido eliminado correctamente.`,
          });
        },
        onError: () => {
          toast({
            title: "Error",
            description: "No se pudo eliminar el trabajador.",
            variant: "destructive",
          });
        },
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
            <div className="rounded-full bg-gray-300 h-12 w-12"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-300 rounded w-1/4"></div>
              <div className="h-3 bg-gray-300 rounded w-1/3"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (workers.length === 0) {
    return (
      <div className="text-center py-8">
        <User className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No hay trabajadores</h3>
        <p className="mt-1 text-sm text-gray-500">
          Comienza agregando tu primer trabajador.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {workers.map((worker) => (
        <div key={worker.id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
          <div className="flex items-center space-x-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={worker.avatar} alt={worker.name} />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                {worker.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-medium text-gray-900">{worker.name}</h3>
                <Badge variant={worker.isActive ? "default" : "secondary"}>
                  {worker.isActive ? "Activo" : "Inactivo"}
                </Badge>
              </div>
              
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                {worker.email && (
                  <div className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    <span>{worker.email}</span>
                  </div>
                )}
                {worker.telefono && (
                  <div className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    <span>{worker.telefono}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEditWorker(worker)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDeleteWorker(worker)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};
