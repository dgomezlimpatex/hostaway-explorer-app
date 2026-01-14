
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DayOfWeekPattern, HourlyPattern } from '@/hooks/analytics/useOperationalAnalytics';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Area, AreaChart } from 'recharts';
import { Calendar, Clock, TrendingUp } from 'lucide-react';

interface TemporalPatternsPanelProps {
  dayPatterns: DayOfWeekPattern[];
  hourPatterns: HourlyPattern[];
}

export const TemporalPatternsPanel = ({ dayPatterns, hourPatterns }: TemporalPatternsPanelProps) => {
  const maxDuration = Math.max(...dayPatterns.map(d => d.avgDuration), 0);
  const minDuration = Math.min(...dayPatterns.map(d => d.avgDuration), 0);
  
  const getDayColor = (duration: number) => {
    const range = maxDuration - minDuration;
    const normalized = (duration - minDuration) / range;
    
    if (normalized > 0.7) return 'hsl(var(--destructive))';
    if (normalized > 0.4) return 'hsl(var(--warning))';
    return 'hsl(var(--success))';
  };

  const formatHour = (hour: number) => {
    return `${hour.toString().padStart(2, '0')}:00`;
  };

  return (
    <div className="space-y-6">
      {/* Day of Week Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Análisis por Día de la Semana
          </CardTitle>
          <CardDescription>
            Duración promedio de tareas y volumen por día
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Duration Chart */}
            <div>
              <h4 className="text-sm font-medium mb-4">Duración Promedio (minutos)</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dayPatterns}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="dayName" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number) => [`${value} min`, 'Duración']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar 
                      dataKey="avgDuration" 
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Task Count Chart */}
            <div>
              <h4 className="text-sm font-medium mb-4">Volumen de Tareas</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dayPatterns}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="dayName" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number) => [value, 'Tareas']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="taskCount" 
                      fill="hsl(var(--secondary))"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Day Cards */}
          <div className="grid grid-cols-7 gap-2 mt-6">
            {dayPatterns.map((day) => (
              <div 
                key={day.dayOfWeek}
                className="p-3 rounded-lg bg-muted/50 text-center"
              >
                <p className="text-xs font-medium text-muted-foreground">
                  {day.dayName.slice(0, 3)}
                </p>
                <p className="text-lg font-bold">{day.avgDuration}</p>
                <p className="text-xs text-muted-foreground">min</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {day.taskCount} tareas
                </p>
                <div className="mt-2">
                  <span 
                    className={`text-xs font-medium ${
                      day.avgEfficiency >= 100 ? 'text-success' :
                      day.avgEfficiency >= 85 ? 'text-primary' : 'text-warning'
                    }`}
                  >
                    {day.avgEfficiency}% ef.
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Hourly Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Análisis por Hora del Día
          </CardTitle>
          <CardDescription>
            Distribución de tareas y duración promedio por hora
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourPatterns}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="hour" 
                  tickFormatter={formatHour}
                  tick={{ fontSize: 11 }}
                />
                <YAxis yAxisId="left" orientation="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip 
                  labelFormatter={(hour: number) => formatHour(hour)}
                  formatter={(value: number, name: string) => [
                    name === 'taskCount' ? value : `${value} min`,
                    name === 'taskCount' ? 'Tareas' : 'Duración'
                  ]}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar 
                  yAxisId="left"
                  dataKey="taskCount" 
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                  opacity={0.8}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="avgDuration" 
                  stroke="hsl(var(--destructive))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--destructive))', strokeWidth: 2 }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-primary" />
              <span className="text-muted-foreground">Número de tareas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-destructive" />
              <span className="text-muted-foreground">Duración promedio</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Insights */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Insights Detectados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {dayPatterns.length > 0 && (
              <>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>
                    El día con mayor duración promedio es <strong>
                      {dayPatterns.reduce((max, d) => d.avgDuration > max.avgDuration ? d : max).dayName}
                    </strong> ({Math.max(...dayPatterns.map(d => d.avgDuration))} min)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success">•</span>
                  <span>
                    El día más eficiente es <strong>
                      {dayPatterns.reduce((max, d) => d.avgEfficiency > max.avgEfficiency ? d : max).dayName}
                    </strong> ({Math.max(...dayPatterns.map(d => d.avgEfficiency))}% eficiencia)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-info">•</span>
                  <span>
                    El día con más tareas es <strong>
                      {dayPatterns.reduce((max, d) => d.taskCount > max.taskCount ? d : max).dayName}
                    </strong> ({Math.max(...dayPatterns.map(d => d.taskCount))} tareas)
                  </span>
                </li>
              </>
            )}
            {hourPatterns.length > 0 && (
              <li className="flex items-start gap-2">
                <span className="text-warning">•</span>
                <span>
                  La hora con más carga es las <strong>
                    {formatHour(hourPatterns.reduce((max, h) => h.taskCount > max.taskCount ? h : max).hour)}
                  </strong>
                </span>
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};
