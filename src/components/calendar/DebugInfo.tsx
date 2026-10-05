
import { Button } from "@/components/ui/button";
import { Task } from "@/types/calendar";

interface DebugInfoProps {
  currentDate: Date;
  currentView: string;
  tasks: Task[];
  assignedTasks: Task[];
  unassignedTasks: Task[];
  onDeleteAllTasks: () => void;
  onDeleteAllHostawayReservations: () => void;
}

export const DebugInfo = ({
  currentDate,
  currentView,
  tasks,
  assignedTasks,
  unassignedTasks,
  onDeleteAllTasks,
  onDeleteAllHostawayReservations
}: DebugInfoProps) => {
  // Calcular fechas para el debug info usando Madrid timezone
  const getMadridDate = () => {
    const now = new Date();
    return new Date(now.toLocaleString("en-US", {timeZone: "Europe/Madrid"}));
  };
  
  const todayMadrid = getMadridDate();
  const todayStr = todayMadrid.toISOString().split('T')[0];
  
  const tomorrowMadrid = new Date(todayMadrid);
  tomorrowMadrid.setDate(tomorrowMadrid.getDate() + 1);
  const tomorrowStr = tomorrowMadrid.toISOString().split('T')[0];

  return (
    <div className="bg-surface border border-line rounded-lg p-4">
      <h3 className="font-semibold text-warning mb-2">Debug Info</h3>
      <p className="text-sm text-warning mb-2">
        Hoy (Madrid): {todayStr} | 
        Mañana (Madrid): {tomorrowStr} | 
        Fecha del calendario: {currentDate.toISOString().split('T')[0]} | 
        Vista: {currentView} | 
        Tareas cargadas: {tasks.length} | 
        Asignadas: {assignedTasks.length} | 
        Sin asignar: {unassignedTasks.length}
      </p>
      <div className="space-x-2">
        <Button 
          variant="destructive" 
          size="sm"
          onClick={onDeleteAllTasks}
        >
          Eliminar todas las tareas
        </Button>
        <Button 
          variant="destructive" 
          size="sm"
          onClick={onDeleteAllHostawayReservations}
        >
          Eliminar todas las reservas Hostaway
        </Button>
      </div>
    </div>
  );
};
