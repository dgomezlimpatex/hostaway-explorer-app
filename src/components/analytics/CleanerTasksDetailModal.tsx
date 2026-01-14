import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CleanerTaskDetail, CleanerPerformanceAnalysis } from '@/hooks/analytics/useOperationalAnalytics';
import { Clock, TrendingUp, Timer, Target } from 'lucide-react';

interface CleanerTasksDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cleaner: CleanerPerformanceAnalysis | null;
  tasks: CleanerTaskDetail[];
}

export const CleanerTasksDetailModal = ({
  open,
  onOpenChange,
  cleaner,
  tasks,
}: CleanerTasksDetailModalProps) => {
  if (!cleaner) return null;

  const getPunctualityBadge = (minutes: number) => {
    if (Math.abs(minutes) <= 10) {
      return <Badge variant="outline" className="bg-success/10 text-success border-success/30">Puntual</Badge>;
    }
    if (minutes < -10) {
      return <Badge variant="outline" className="bg-info/10 text-info border-info/30">{minutes} min</Badge>;
    }
    return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">+{minutes} min</Badge>;
  };

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 100) return 'text-success';
    if (efficiency >= 85) return 'text-primary';
    if (efficiency >= 70) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>{cleaner.cleanerName}</DialogTitle>
          <DialogDescription>
            {cleaner.taskCount} tareas realizadas en el período seleccionado
          </DialogDescription>
        </DialogHeader>

        {/* Summary Cards */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className={`text-lg font-bold ${getEfficiencyColor(cleaner.avgEfficiency)}`}>
                    {cleaner.avgEfficiency}%
                  </p>
                  <p className="text-xs text-muted-foreground">Eficiencia</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-lg font-bold">{cleaner.onTimePercentage}%</p>
                  <p className="text-xs text-muted-foreground">Puntualidad</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-lg font-bold">{cleaner.avgTaskDuration} min</p>
                  <p className="text-xs text-muted-foreground">Tiempo Promedio</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-lg font-bold">±{cleaner.consistencyScore} min</p>
                  <p className="text-xs text-muted-foreground">Variabilidad</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <ScrollArea className="h-[50vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Propiedad</TableHead>
                <TableHead className="text-right">Estimado</TableHead>
                <TableHead className="text-right">Real</TableHead>
                <TableHead className="text-right">Eficiencia</TableHead>
                <TableHead>Puntualidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => {
                const efficiency = Math.round((task.estimatedMinutes / task.actualMinutes) * 100);
                
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
                    <TableCell>
                      <div>
                        <p className="font-medium">{task.propertyName}</p>
                        <p className="text-xs text-muted-foreground">{task.propertyCode}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {task.estimatedMinutes} min
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {task.actualMinutes} min
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-mono font-bold ${getEfficiencyColor(efficiency)}`}>
                        {efficiency}%
                      </span>
                    </TableCell>
                    <TableCell>
                      {getPunctualityBadge(task.punctualityMinutes)}
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
