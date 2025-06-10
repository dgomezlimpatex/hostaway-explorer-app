
import { StatusIndicator } from "@/components/ui/status-indicator";

export const StatusLegend = () => {
  return (
    <div className="flex items-center gap-6 text-sm bg-card p-4 rounded-lg shadow-sm border animate-fade-in">
      <span className="text-muted-foreground font-medium">Estado de las tareas:</span>
      <div className="flex items-center gap-2">
        <StatusIndicator status="pending" size="sm" showTooltip={false} />
        <span className="text-foreground">Pendiente</span>
      </div>
      <div className="flex items-center gap-2">
        <StatusIndicator status="in-progress" size="sm" showTooltip={false} />
        <span className="text-foreground">En Progreso</span>
      </div>
      <div className="flex items-center gap-2">
        <StatusIndicator status="completed" size="sm" showTooltip={false} />
        <span className="text-foreground">Completado</span>
      </div>
      <div className="flex items-center gap-2">
        <StatusIndicator status="cancelled" size="sm" showTooltip={false} />
        <span className="text-foreground">Cancelado</span>
      </div>
    </div>
  );
};
