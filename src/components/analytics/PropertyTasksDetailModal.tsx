import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { PropertyTaskDetail } from '@/hooks/analytics/useOperationalAnalytics';

interface PropertyTasksDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyName: string;
  propertyCode: string;
  tasks: PropertyTaskDetail[];
  estimatedMinutes: number;
}

export const PropertyTasksDetailModal = ({
  open,
  onOpenChange,
  propertyName,
  propertyCode,
  tasks,
  estimatedMinutes,
}: PropertyTasksDetailModalProps) => {
  const getDifferenceColor = (diff: number) => {
    if (Math.abs(diff) <= 15) return 'text-success';
    if (diff > 0) return 'text-destructive';
    return 'text-info';
  };

  const getEfficiencyBadge = (efficiency: number) => {
    if (efficiency >= 100) {
      return <Badge variant="outline" className="bg-success/10 text-success border-success/30">Excelente</Badge>;
    }
    if (efficiency >= 85) {
      return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">Bueno</Badge>;
    }
    if (efficiency >= 70) {
      return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">Regular</Badge>;
    }
    return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">Bajo</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {propertyName}
            <Badge variant="secondary">{propertyCode}</Badge>
          </DialogTitle>
          <DialogDescription>
            {tasks.length} tareas realizadas • Tiempo estimado: {estimatedMinutes} min
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Limpiadora</TableHead>
                <TableHead className="text-right">Duración Real</TableHead>
                <TableHead className="text-right">Diferencia</TableHead>
                <TableHead className="text-right">Eficiencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => {
                const diff = task.actualMinutes - estimatedMinutes;
                const diffPercent = Math.round((diff / estimatedMinutes) * 100);
                const efficiency = Math.round((estimatedMinutes / task.actualMinutes) * 100);
                
                return (
                  <TableRow key={task.taskId}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {format(task.taskDate, 'dd MMM yyyy', { locale: es })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(task.taskDate, 'EEEE', { locale: es })}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{task.cleanerName}</TableCell>
                    <TableCell className="text-right font-mono">
                      {task.actualMinutes} min
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={getDifferenceColor(diffPercent)}>
                        {diff > 0 ? '+' : ''}{Math.round(diff)} min ({diffPercent > 0 ? '+' : ''}{diffPercent}%)
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {getEfficiencyBadge(efficiency)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
