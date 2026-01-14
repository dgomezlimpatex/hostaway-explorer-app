
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Clock, TrendingUp, AlertTriangle, CheckCircle, Timer, Zap } from 'lucide-react';
import { CleanerPerformanceAnalysis } from '@/hooks/analytics/useOperationalAnalytics';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface CleanerPerformancePanelProps {
  performance: CleanerPerformanceAnalysis[];
}

export const CleanerPerformancePanel = ({ performance }: CleanerPerformancePanelProps) => {
  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 100) return 'text-success';
    if (efficiency >= 85) return 'text-primary';
    if (efficiency >= 70) return 'text-warning';
    return 'text-destructive';
  };

  const getEfficiencyBgColor = (efficiency: number) => {
    if (efficiency >= 100) return 'bg-success';
    if (efficiency >= 85) return 'bg-primary';
    if (efficiency >= 70) return 'bg-warning';
    return 'bg-destructive';
  };

  const getPunctualityBadge = (avgPunctuality: number) => {
    if (Math.abs(avgPunctuality) <= 5) {
      return <Badge variant="outline" className="bg-success/10 text-success border-success/30">Puntual</Badge>;
    }
    if (avgPunctuality < -5) {
      return <Badge variant="outline" className="bg-info/10 text-info border-info/30">Temprano ({avgPunctuality} min)</Badge>;
    }
    return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">Tardío (+{avgPunctuality} min)</Badge>;
  };

  const chartData = performance.slice(0, 10).map(c => ({
    name: c.cleanerName.split(' ')[0], // First name only
    efficiency: c.avgEfficiency,
    tasks: c.taskCount,
  }));

  const getBarColor = (efficiency: number) => {
    if (efficiency >= 100) return 'hsl(var(--success))';
    if (efficiency >= 85) return 'hsl(var(--primary))';
    if (efficiency >= 70) return 'hsl(var(--warning))';
    return 'hsl(var(--destructive))';
  };

  return (
    <div className="space-y-6">
      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Eficiencia por Trabajador
          </CardTitle>
          <CardDescription>
            Comparativa de eficiencia entre trabajadores (tiempo estimado vs real)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" domain={[0, 150]} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" width={80} />
                <Tooltip 
                  formatter={(value: number) => [`${value}%`, 'Eficiencia']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="efficiency" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getBarColor(entry.efficiency)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-success" />
              <span className="text-muted-foreground">≥100% Excelente</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-primary" />
              <span className="text-muted-foreground">85-99% Bueno</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-warning" />
              <span className="text-muted-foreground">70-84% Regular</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-destructive" />
              <span className="text-muted-foreground">&lt;70% Bajo</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Detalle por Trabajador
          </CardTitle>
          <CardDescription>
            Métricas completas de rendimiento individual
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trabajador</TableHead>
                <TableHead className="text-right">Eficiencia</TableHead>
                <TableHead>Puntualidad</TableHead>
                <TableHead className="text-right">Tiempo Promedio</TableHead>
                <TableHead className="text-right">Variabilidad</TableHead>
                <TableHead className="text-right">Tareas</TableHead>
                <TableHead>Distribución Puntualidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {performance.map((cleaner) => (
                <TableRow key={cleaner.cleanerId}>
                  <TableCell>
                    <div className="font-medium">{cleaner.cleanerName}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Progress 
                        value={Math.min(100, cleaner.avgEfficiency)} 
                        className={`h-2 w-16 ${getEfficiencyBgColor(cleaner.avgEfficiency)}`}
                      />
                      <span className={`font-mono font-bold ${getEfficiencyColor(cleaner.avgEfficiency)}`}>
                        {cleaner.avgEfficiency}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getPunctualityBadge(cleaner.avgPunctuality)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end">
                      <span className="font-mono">{cleaner.avgTaskDuration} min</span>
                      <span className="text-xs text-muted-foreground">
                        ({cleaner.minDuration}-{cleaner.maxDuration})
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={cleaner.consistencyScore <= 15 ? 'secondary' : 'outline'}>
                      ±{cleaner.consistencyScore} min
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {cleaner.taskCount}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 items-center">
                      <div className="flex h-4 w-full max-w-[120px] rounded overflow-hidden">
                        <div 
                          className="bg-info h-full" 
                          style={{ width: `${cleaner.earlyPercentage}%` }}
                          title={`Temprano: ${cleaner.earlyPercentage}%`}
                        />
                        <div 
                          className="bg-success h-full" 
                          style={{ width: `${cleaner.onTimePercentage}%` }}
                          title={`Puntual: ${cleaner.onTimePercentage}%`}
                        />
                        <div 
                          className="bg-warning h-full" 
                          style={{ width: `${cleaner.latePercentage}%` }}
                          title={`Tarde: ${cleaner.latePercentage}%`}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-20">
                        {cleaner.onTimePercentage}% puntual
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-sm">Eficiencia</p>
                <p className="text-xs text-muted-foreground">
                  (Tiempo estimado ÷ Tiempo real) × 100. Mayor a 100% significa que termina antes de lo esperado.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Timer className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-sm">Variabilidad</p>
                <p className="text-xs text-muted-foreground">
                  Desviación estándar del tiempo de tareas. Menor valor = más consistente.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-sm">Puntualidad</p>
                <p className="text-xs text-muted-foreground">
                  Diferencia entre hora programada y hora real de inicio (±10 min = puntual).
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
