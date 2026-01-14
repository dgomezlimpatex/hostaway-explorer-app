
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Users, Building2, TrendingUp, TrendingDown, Search, Star } from 'lucide-react';
import { CleanerPropertyCorrelation } from '@/hooks/analytics/useOperationalAnalytics';

interface CorrelationsPanelProps {
  correlations: CleanerPropertyCorrelation[];
}

export const CorrelationsPanel = ({ correlations }: CorrelationsPanelProps) => {
  const [filter, setFilter] = useState<'all' | 'efficient' | 'inefficient'>('all');
  const [search, setSearch] = useState('');
  const [groupBy, setGroupBy] = useState<'none' | 'cleaner' | 'property'>('none');

  const filteredCorrelations = correlations
    .filter(c => {
      if (filter === 'efficient') return c.efficiency >= 90;
      if (filter === 'inefficient') return c.efficiency < 80;
      return true;
    })
    .filter(c => 
      c.cleanerName.toLowerCase().includes(search.toLowerCase()) ||
      c.propertyName.toLowerCase().includes(search.toLowerCase())
    );

  // Get unique cleaners and properties for grouping
  const cleanerGroups = new Map<string, CleanerPropertyCorrelation[]>();
  const propertyGroups = new Map<string, CleanerPropertyCorrelation[]>();

  filteredCorrelations.forEach(c => {
    const cleanerGroup = cleanerGroups.get(c.cleanerId) || [];
    cleanerGroup.push(c);
    cleanerGroups.set(c.cleanerId, cleanerGroup);

    const propertyGroup = propertyGroups.get(c.propertyId) || [];
    propertyGroup.push(c);
    propertyGroups.set(c.propertyId, propertyGroup);
  });

  // Find best performers for each property
  const bestPerformers = new Map<string, CleanerPropertyCorrelation>();
  propertyGroups.forEach((items, propertyId) => {
    const best = items.reduce((max, c) => c.efficiency > max.efficiency ? c : max);
    bestPerformers.set(propertyId, best);
  });

  const getEfficiencyBadge = (efficiency: number) => {
    if (efficiency >= 100) {
      return <Badge className="bg-success/10 text-success border-success/30">Excelente</Badge>;
    }
    if (efficiency >= 90) {
      return <Badge className="bg-primary/10 text-primary border-primary/30">Bueno</Badge>;
    }
    if (efficiency >= 80) {
      return <Badge className="bg-warning/10 text-warning border-warning/30">Regular</Badge>;
    }
    return <Badge className="bg-destructive/10 text-destructive border-destructive/30">Bajo</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-success/30 bg-success/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-success" />
              <div>
                <p className="text-2xl font-bold text-success">
                  {correlations.filter(c => c.efficiency >= 90).length}
                </p>
                <p className="text-sm text-muted-foreground">Combinaciones Eficientes</p>
                <p className="text-xs text-muted-foreground">Eficiencia ≥90%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingDown className="h-8 w-8 text-warning" />
              <div>
                <p className="text-2xl font-bold text-warning">
                  {correlations.filter(c => c.efficiency < 80).length}
                </p>
                <p className="text-sm text-muted-foreground">Combinaciones Problemáticas</p>
                <p className="text-xs text-muted-foreground">Eficiencia &lt;80%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Star className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold text-primary">
                  {bestPerformers.size}
                </p>
                <p className="text-sm text-muted-foreground">Propiedades con Mejor Match</p>
                <p className="text-xs text-muted-foreground">Trabajador ideal identificado</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Best Matches */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-warning" />
            Mejores Combinaciones Trabajador-Propiedad
          </CardTitle>
          <CardDescription>
            Para cada propiedad, el trabajador con mejor rendimiento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Array.from(bestPerformers.values()).slice(0, 12).map((match) => (
              <div 
                key={`${match.cleanerId}-${match.propertyId}`}
                className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-sm">{match.propertyName}</p>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span className="text-xs">{match.cleanerName}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                    {match.efficiency}%
                  </Badge>
                </div>
                <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{match.avgDuration} min promedio</span>
                  <span>{match.taskCount} tareas</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Todas las Correlaciones
          </CardTitle>
          <CardDescription>
            Análisis detallado de rendimiento por trabajador y propiedad
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar trabajador o propiedad..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="efficient">Eficientes (≥90%)</SelectItem>
                <SelectItem value="inefficient">Problemáticos (&lt;80%)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trabajador</TableHead>
                <TableHead>Propiedad</TableHead>
                <TableHead className="text-right">Eficiencia</TableHead>
                <TableHead className="text-right">Tiempo Promedio</TableHead>
                <TableHead className="text-right">Tareas</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCorrelations.slice(0, 25).map((corr) => (
                <TableRow key={`${corr.cleanerId}-${corr.propertyId}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{corr.cleanerName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>{corr.propertyName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={`font-mono font-bold ${
                      corr.efficiency >= 100 ? 'text-success' :
                      corr.efficiency >= 90 ? 'text-primary' :
                      corr.efficiency >= 80 ? 'text-warning' : 'text-destructive'
                    }`}>
                      {corr.efficiency}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {corr.avgDuration} min
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {corr.taskCount}
                  </TableCell>
                  <TableCell>
                    {getEfficiencyBadge(corr.efficiency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredCorrelations.length > 25 && (
            <p className="text-center text-sm text-muted-foreground mt-4">
              Mostrando 25 de {filteredCorrelations.length} resultados
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
