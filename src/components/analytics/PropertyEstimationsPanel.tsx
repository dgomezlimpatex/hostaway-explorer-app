
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowDown, ArrowUp, CheckCircle, AlertTriangle, Clock, ExternalLink } from 'lucide-react';
import { PropertyEstimationAnalysis } from '@/hooks/analytics/useOperationalAnalytics';
import { PropertyTasksDetailModal } from './PropertyTasksDetailModal';

interface PropertyEstimationsPanelProps {
  estimations: PropertyEstimationAnalysis[];
}

export const PropertyEstimationsPanel = ({ estimations }: PropertyEstimationsPanelProps) => {
  const [selectedProperty, setSelectedProperty] = useState<PropertyEstimationAnalysis | null>(null);
  
  const overestimated = estimations.filter(e => e.status === 'overestimated');
  const underestimated = estimations.filter(e => e.status === 'underestimated');
  const accurate = estimations.filter(e => e.status === 'accurate');

  const getStatusBadge = (status: string, diffPercent: number) => {
    switch (status) {
      case 'overestimated':
        return (
          <Badge variant="outline" className="bg-info/10 text-info border-info/30 gap-1">
            <ArrowDown className="h-3 w-3" />
            Sobreestimada ({diffPercent}%)
          </Badge>
        );
      case 'underestimated':
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 gap-1">
            <ArrowUp className="h-3 w-3" />
            Subestimada (+{Math.abs(diffPercent)}%)
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-success/10 text-success border-success/30 gap-1">
            <CheckCircle className="h-3 w-3" />
            Correcta
          </Badge>
        );
    }
  };

  const handlePropertyClick = (prop: PropertyEstimationAnalysis) => {
    setSelectedProperty(prop);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-info/30 bg-info/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ArrowDown className="h-8 w-8 text-info" />
              <div>
                <p className="text-2xl font-bold text-info">{overestimated.length}</p>
                <p className="text-sm text-muted-foreground">Sobreestimadas</p>
                <p className="text-xs text-muted-foreground">Tiempo real menor al estimado</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ArrowUp className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-2xl font-bold text-destructive">{underestimated.length}</p>
                <p className="text-sm text-muted-foreground">Subestimadas</p>
                <p className="text-xs text-muted-foreground">Tiempo real mayor al estimado</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-success/30 bg-success/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-success" />
              <div>
                <p className="text-2xl font-bold text-success">{accurate.length}</p>
                <p className="text-sm text-muted-foreground">Correctas</p>
                <p className="text-xs text-muted-foreground">Diferencia menor al 15%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Properties requiring attention */}
      {(overestimated.length > 0 || underestimated.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Propiedades que Requieren Ajuste
            </CardTitle>
            <CardDescription>
              Propiedades con diferencia superior al 15% entre tiempo estimado y real. Click en una fila para ver detalles.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Propiedad</TableHead>
                  <TableHead className="text-right">Estimado</TableHead>
                  <TableHead className="text-right">Real Promedio</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                  <TableHead className="text-right">Tareas</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Sugerencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...underestimated, ...overestimated].slice(0, 15).map((prop) => (
                  <TableRow 
                    key={prop.propertyId}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handlePropertyClick(prop)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-medium">{prop.propertyName}</p>
                          <p className="text-xs text-muted-foreground">{prop.propertyCode}</p>
                        </div>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {prop.estimatedMinutes} min
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {prop.avgActualMinutes} min
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={prop.differenceMinutes > 0 ? 'text-destructive' : 'text-info'}>
                        {prop.differenceMinutes > 0 ? '+' : ''}{prop.differenceMinutes} min
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {prop.taskCount}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(prop.status, prop.differencePercentage)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className="font-mono">
                        {prop.suggestedDuration} min
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* All properties table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Todas las Propiedades
          </CardTitle>
          <CardDescription>
            Vista completa de estimaciones por propiedad. Click en una fila para ver tareas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Propiedad</TableHead>
                <TableHead className="text-right">Estimado</TableHead>
                <TableHead className="text-right">Real</TableHead>
                <TableHead>Precisión</TableHead>
                <TableHead className="text-right">Tareas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {estimations.map((prop) => {
                const accuracy = 100 - Math.abs(prop.differencePercentage);
                return (
                  <TableRow 
                    key={prop.propertyId}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handlePropertyClick(prop)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-medium">{prop.propertyName}</p>
                          <p className="text-xs text-muted-foreground">{prop.propertyCode}</p>
                        </div>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {prop.estimatedMinutes} min
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {prop.avgActualMinutes} min
                    </TableCell>
                    <TableCell className="w-48">
                      <div className="flex items-center gap-2">
                        <Progress 
                          value={Math.max(0, Math.min(100, accuracy))} 
                          className="h-2"
                        />
                        <span className="text-xs text-muted-foreground w-12">
                          {Math.round(accuracy)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {prop.taskCount}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <PropertyTasksDetailModal
        open={!!selectedProperty}
        onOpenChange={(open) => !open && setSelectedProperty(null)}
        propertyName={selectedProperty?.propertyName || ''}
        propertyCode={selectedProperty?.propertyCode || ''}
        tasks={selectedProperty?.tasks || []}
        estimatedMinutes={selectedProperty?.estimatedMinutes || 0}
      />
    </div>
  );
};
