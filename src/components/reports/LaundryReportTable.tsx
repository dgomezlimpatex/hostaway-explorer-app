
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { LaundryReport } from '@/types/reports';

interface LaundryReportTableProps {
  data: LaundryReport[];
}

export const LaundryReportTable = ({ data }: LaundryReportTableProps) => {
  // Agrupar por fecha para mejor organización
  const groupedByDate = data.reduce((acc, item) => {
    if (!acc[item.date]) {
      acc[item.date] = [];
    }
    acc[item.date].push(item);
    return acc;
  }, {} as Record<string, LaundryReport[]>);

  // Calcular totales generales
  const totalTextiles = data.reduce((acc, item) => {
    acc.sabanas += item.textiles.sabanas;
    acc.toallasGrandes += item.textiles.toallasGrandes;
    acc.toallasPequenas += item.textiles.toallasPequenas;
    acc.alfombrines += item.textiles.alfombrines;
    acc.fundasAlmohada += item.textiles.fundasAlmohada;
    return acc;
  }, {
    sabanas: 0,
    toallasGrandes: 0,
    toallasPequenas: 0,
    alfombrines: 0,
    fundasAlmohada: 0
  });

  const totalItemsCount = Object.values(totalTextiles).reduce((sum, count) => sum + count, 0);

  return (
    <div className="space-y-6">
      {/* Resumen general */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🧺 Resumen de Preparación de Lavandería
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{totalTextiles.sabanas}</div>
              <div className="text-sm text-blue-800">Sábanas</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{totalTextiles.toallasGrandes}</div>
              <div className="text-sm text-green-800">Toallas Grandes</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{totalTextiles.toallasPequenas}</div>
              <div className="text-sm text-purple-800">Toallas Pequeñas</div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{totalTextiles.alfombrines}</div>
              <div className="text-sm text-orange-800">Alfombrines</div>
            </div>
            <div className="text-center p-3 bg-pink-50 rounded-lg">
              <div className="text-2xl font-bold text-pink-600">{totalTextiles.fundasAlmohada}</div>
              <div className="text-sm text-pink-800">Fundas Almohada</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">{totalItemsCount}</div>
              <div className="text-sm text-gray-800">Total Items</div>
            </div>
          </div>
          <div className="text-center text-sm text-gray-600">
            Total de tareas programadas: {data.length}
          </div>
        </CardContent>
      </Card>

      {/* Lista detallada por fecha */}
      {Object.entries(groupedByDate).map(([date, tasks]) => (
        <Card key={date}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📅 {new Date(date).toLocaleDateString('es-ES', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Propiedad</TableHead>
                  <TableHead>Horario</TableHead>
                  <TableHead>Trabajador</TableHead>
                  <TableHead>Habitaciones</TableHead>
                  <TableHead>Textiles Requeridos</TableHead>
                  <TableHead>Total Items</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <div className="font-medium">{task.property}</div>
                      <div className="text-sm text-gray-500">{task.address}</div>
                    </TableCell>
                    <TableCell className="font-mono">
                      {task.startTime} - {task.endTime}
                    </TableCell>
                    <TableCell>{task.cleaner}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>🛏️ {task.bedrooms} camas</div>
                        <div>🚿 {task.bathrooms} baños</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {task.textiles.sabanas > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {task.textiles.sabanas} sábanas
                          </Badge>
                        )}
                        {task.textiles.toallasGrandes > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {task.textiles.toallasGrandes} toallas G
                          </Badge>
                        )}
                        {task.textiles.toallasPequenas > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {task.textiles.toallasPequenas} toallas P
                          </Badge>
                        )}
                        {task.textiles.alfombrines > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {task.textiles.alfombrines} alfombr.
                          </Badge>
                        )}
                        {task.textiles.fundasAlmohada > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {task.textiles.fundasAlmohada} fundas
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-bold text-lg">{task.totalItems}</div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={task.status === 'pending' ? 'secondary' : 'outline'}
                        className={
                          task.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-blue-100 text-blue-800'
                        }
                      >
                        {task.status === 'pending' ? 'Pendiente' : 'En Progreso'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {data.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <div className="text-gray-500">
              No hay tareas programadas para el período seleccionado
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
