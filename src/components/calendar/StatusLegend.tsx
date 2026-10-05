
import { TaskStatusBadge } from './TaskStatusBadge';

export const StatusLegend = () => {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 px-2 py-2 text-ink-2" aria-label="Leyenda de estados de tareas">
      {(['pending', 'in-progress', 'completed'] as const).map(status => (
        <TaskStatusBadge key={status} status={status} showLabel />
      ))}
      <span className="text-xs text-muted-foreground">El fondo identifica al cliente.</span>
    </div>
  );
};
