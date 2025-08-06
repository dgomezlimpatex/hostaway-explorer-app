
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
    acc.sabanasRequenas += item.textiles.sabanasRequenas;
    acc.sabanasSuite += item.textiles.sabanasSuite;
    acc.toallasGrandes += item.textiles.toallasGrandes;
    acc.toallasPequenas += item.textiles.toallasPequenas;
    acc.alfombrines += item.textiles.alfombrines;
    acc.fundasAlmohada += item.textiles.fundasAlmohada;
    return acc;
  }, {
    sabanas: 0,
    sabanasRequenas: 0,
    sabanasSuite: 0,
    toallasGrandes: 0,
    toallasPequenas: 0,
    alfombrines: 0,
    fundasAlmohada: 0
  });

  const totalKitAlimentario = data.reduce((sum, item) => sum + item.kitAlimentario, 0);
  const totalAmenitiesBano = data.reduce((sum, item) => sum + item.amenitiesBano, 0);
  const totalAmenitiesCocina = data.reduce((sum, item) => sum + item.amenitiesCocina, 0);
  const totalRollosPapelHigienico = data.reduce((sum, item) => sum + item.rollosPapelHigienico, 0);
  const totalRollosPapelCocina = data.reduce((sum, item) => sum + item.rollosPapelCocina, 0);

  // Componente para vista móvil
  const MobileTaskCard = ({ task }: { task: LaundryReport }) => (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header con propiedad y estado */}
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="font-semibold text-lg leading-tight">{task.property}</h3>
              <p className="text-sm text-muted-foreground mt-1">{task.address}</p>
            </div>
            <Badge 
              variant={task.status === 'pending' ? 'secondary' : 'outline'}
              className={
                task.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                'bg-blue-100 text-blue-800'
              }
            >
              {task.status === 'pending' ? 'Pendiente' : 'En Progreso'}
            </Badge>
          </div>

          {/* Horario y trabajador */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground font-medium">HORARIO</p>
              <p className="font-mono text-sm">{task.startTime} - {task.endTime}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">TRABAJADOR</p>
              <p className="text-sm">{task.cleaner}</p>
            </div>
          </div>

          {/* Habitaciones */}
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1">CAMAS</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span>🛏️ {task.bedrooms} camas</span>
              <span>🛏️ {task.bedroomsSmall} pequeñas</span>
              <span>🏨 {task.bedroomsSuite} suite</span>
              <span>🛋️ {task.sofaBeds} sofás cama</span>
              <span>🚿 {task.bathrooms} baños</span>
            </div>
          </div>

          {/* Textiles requeridos */}
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-2">TEXTILES REQUERIDOS</p>
            <div className="grid grid-cols-2 gap-2">
              {task.textiles.sabanas > 0 && (
                <div className="bg-blue-50 p-2 rounded text-center">
                  <div className="font-bold text-blue-600">{task.textiles.sabanas}</div>
                  <div className="text-xs text-blue-800">Sábanas</div>
                </div>
              )}
              {task.textiles.sabanasRequenas > 0 && (
                <div className="bg-indigo-50 p-2 rounded text-center">
                  <div className="font-bold text-indigo-600">{task.textiles.sabanasRequenas}</div>
                  <div className="text-xs text-indigo-800">Sábanas P</div>
                </div>
              )}
              {task.textiles.sabanasSuite > 0 && (
                <div className="bg-violet-50 p-2 rounded text-center">
                  <div className="font-bold text-violet-600">{task.textiles.sabanasSuite}</div>
                  <div className="text-xs text-violet-800">Sábanas S</div>
                </div>
              )}
              {task.textiles.toallasGrandes > 0 && (
                <div className="bg-green-50 p-2 rounded text-center">
                  <div className="font-bold text-green-600">{task.textiles.toallasGrandes}</div>
                  <div className="text-xs text-green-800">Toallas G</div>
                </div>
              )}
              {task.textiles.toallasPequenas > 0 && (
                <div className="bg-purple-50 p-2 rounded text-center">
                  <div className="font-bold text-purple-600">{task.textiles.toallasPequenas}</div>
                  <div className="text-xs text-purple-800">Toallas P</div>
                </div>
              )}
              {task.textiles.alfombrines > 0 && (
                <div className="bg-orange-50 p-2 rounded text-center">
                  <div className="font-bold text-orange-600">{task.textiles.alfombrines}</div>
                  <div className="text-xs text-orange-800">Alfombrines</div>
                </div>
              )}
              {task.textiles.fundasAlmohada > 0 && (
                <div className="bg-pink-50 p-2 rounded text-center">
                  <div className="font-bold text-pink-600">{task.textiles.fundasAlmohada}</div>
                  <div className="text-xs text-pink-800">Fundas</div>
                </div>
              )}
            </div>
          </div>

          {/* Amenities */}
          <div className="grid grid-cols-3 gap-2">
            {task.kitAlimentario > 0 && (
              <div className="bg-yellow-50 p-2 rounded text-center">
                <div className="font-bold text-yellow-600">{task.kitAlimentario}</div>
                <div className="text-xs text-yellow-800">Alimentario</div>
              </div>
            )}
            {task.amenitiesBano > 0 && (
              <div className="bg-cyan-50 p-2 rounded text-center">
                <div className="font-bold text-cyan-600">{task.amenitiesBano}</div>
                <div className="text-xs text-cyan-800">Baño</div>
              </div>
            )}
            {task.amenitiesCocina > 0 && (
              <div className="bg-emerald-50 p-2 rounded text-center">
                <div className="font-bold text-emerald-600">{task.amenitiesCocina}</div>
                <div className="text-xs text-emerald-800">Cocina</div>
              </div>
            )}
            {task.rollosPapelHigienico > 0 && (
              <div className="bg-gray-50 p-2 rounded text-center">
                <div className="font-bold text-gray-600">{task.rollosPapelHigienico}</div>
                <div className="text-xs text-gray-800">Papel WC</div>
              </div>
            )}
            {task.rollosPapelCocina > 0 && (
              <div className="bg-amber-50 p-2 rounded text-center">
                <div className="font-bold text-amber-600">{task.rollosPapelCocina}</div>
                <div className="text-xs text-amber-800">Papel Coc</div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

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
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-4 mb-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{totalTextiles.sabanas}</div>
              <div className="text-sm text-blue-800">Sábanas</div>
            </div>
            <div className="text-center p-3 bg-indigo-50 rounded-lg">
              <div className="text-2xl font-bold text-indigo-600">{totalTextiles.sabanasRequenas}</div>
              <div className="text-sm text-indigo-800">Sábanas P</div>
            </div>
            <div className="text-center p-3 bg-violet-50 rounded-lg">
              <div className="text-2xl font-bold text-violet-600">{totalTextiles.sabanasSuite}</div>
              <div className="text-sm text-violet-800">Sábanas Suite</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{totalTextiles.toallasGrandes}</div>
              <div className="text-sm text-green-800">Toallas G</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{totalTextiles.toallasPequenas}</div>
              <div className="text-sm text-purple-800">Toallas P</div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{totalTextiles.alfombrines}</div>
              <div className="text-sm text-orange-800">Alfombrines</div>
            </div>
            <div className="text-center p-3 bg-pink-50 rounded-lg">
              <div className="text-2xl font-bold text-pink-600">{totalTextiles.fundasAlmohada}</div>
              <div className="text-sm text-pink-800">Fundas</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{totalKitAlimentario}</div>
              <div className="text-sm text-yellow-800">Alimentario</div>
            </div>
            <div className="text-center p-3 bg-cyan-50 rounded-lg">
              <div className="text-2xl font-bold text-cyan-600">{totalAmenitiesBano}</div>
              <div className="text-sm text-cyan-800">Amenities Baño</div>
            </div>
            <div className="text-center p-3 bg-emerald-50 rounded-lg">
              <div className="text-2xl font-bold text-emerald-600">{totalAmenitiesCocina}</div>
              <div className="text-sm text-emerald-800">Amenities Cocina</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">{totalRollosPapelHigienico}</div>
              <div className="text-sm text-gray-800">Papel WC</div>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <div className="text-2xl font-bold text-amber-600">{totalRollosPapelCocina}</div>
              <div className="text-sm text-amber-800">Papel Cocina</div>
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
            {/* Vista desktop - tabla */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Propiedad</TableHead>
                    <TableHead>Horario</TableHead>
                    <TableHead>Trabajador</TableHead>
                    <TableHead>Habitaciones</TableHead>
                    <TableHead>Textiles Requeridos</TableHead>
                    <TableHead>Amenities</TableHead>
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
                          <div>🛏️ {task.bedroomsSmall} pequeñas</div>
                          <div>🏨 {task.bedroomsSuite} suite</div>
                          <div>🛋️ {task.sofaBeds} sofás cama</div>
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
                          {task.textiles.sabanasRequenas > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {task.textiles.sabanasRequenas} sábanas P
                            </Badge>
                          )}
                          {task.textiles.sabanasSuite > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {task.textiles.sabanasSuite} sábanas S
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
                        <div className="flex flex-wrap gap-1">
                          {task.kitAlimentario > 0 && (
                            <Badge variant="outline" className="text-xs bg-yellow-50">
                              🍽️ {task.kitAlimentario} alimentario
                            </Badge>
                          )}
                          {task.amenitiesBano > 0 && (
                            <Badge variant="outline" className="text-xs bg-cyan-50">
                              🛁 {task.amenitiesBano} baño
                            </Badge>
                          )}
                          {task.amenitiesCocina > 0 && (
                            <Badge variant="outline" className="text-xs bg-emerald-50">
                              👨‍🍳 {task.amenitiesCocina} cocina
                            </Badge>
                          )}
                          {task.rollosPapelHigienico > 0 && (
                            <Badge variant="outline" className="text-xs bg-gray-50">
                              🧻 {task.rollosPapelHigienico} papel WC
                            </Badge>
                          )}
                          {task.rollosPapelCocina > 0 && (
                            <Badge variant="outline" className="text-xs bg-amber-50">
                              🍽️ {task.rollosPapelCocina} papel cocina
                            </Badge>
                          )}
                        </div>
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
            </div>

            {/* Vista móvil - cards */}
            <div className="md:hidden">
              {tasks.map((task) => (
                <MobileTaskCard key={task.id} task={task} />
              ))}
            </div>
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
