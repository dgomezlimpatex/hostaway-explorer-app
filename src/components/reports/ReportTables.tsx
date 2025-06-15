import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TaskReport, BillingReport, SummaryReport } from '@/types/reports';

interface TaskReportTableProps {
  data: TaskReport[];
}

export const TaskReportTable = ({ data }: TaskReportTableProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>📋 Listado de Tareas</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Propiedad</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Horario</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Trabajador</TableHead>
              <TableHead>Cliente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((task) => (
              <TableRow key={task.id}>
                <TableCell className="font-medium">{task.property}</TableCell>
                <TableCell>{task.address}</TableCell>
                <TableCell>{task.date}</TableCell>
                <TableCell>{task.startTime} - {task.endTime}</TableCell>
                <TableCell>{task.type}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    task.status === 'completed' ? 'bg-green-100 text-green-800' :
                    task.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {task.status === 'completed' ? 'Completada' :
                     task.status === 'in-progress' ? 'En Progreso' : 'Pendiente'}
                  </span>
                </TableCell>
                <TableCell>{task.cleaner}</TableCell>
                <TableCell>{task.client}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

interface BillingReportTableProps {
  data: BillingReport[];
}

export const BillingReportTable = ({ data }: BillingReportTableProps) => {
  const totalRevenue = data.reduce((sum, item) => sum + item.cost, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>💰 Reporte de Facturación</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-800">Total Ingresos: €{totalRevenue.toFixed(2)}</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Propiedad</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Servicio</TableHead>
              <TableHead>Duración</TableHead>
              <TableHead>Coste</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.property}</TableCell>
                <TableCell>{item.client}</TableCell>
                <TableCell>{item.date}</TableCell>
                <TableCell>{item.serviceType}</TableCell>
                <TableCell>{item.duration} min</TableCell>
                <TableCell>€{item.cost.toFixed(2)}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    item.status === 'completed' ? 'bg-green-100 text-green-800' :
                    item.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {item.status === 'completed' ? 'Facturado' :
                     item.status === 'in-progress' ? 'En Progreso' : 'Pendiente'}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

interface SummaryReportCardProps {
  data: SummaryReport;
}

export const SummaryReportCard = ({ data }: SummaryReportCardProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>📊 Resumen de Tareas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Total:</span>
              <span className="font-bold">{data.totalTasks}</span>
            </div>
            <div className="flex justify-between">
              <span>Completadas:</span>
              <span className="font-bold text-green-600">{data.completedTasks}</span>
            </div>
            <div className="flex justify-between">
              <span>Pendientes:</span>
              <span className="font-bold text-yellow-600">{data.pendingTasks}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>🏆 Top Trabajadores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.topCleaners.map((cleaner, index) => (
              <div key={cleaner.name} className="flex justify-between">
                <span>{index + 1}. {cleaner.name}</span>
                <span className="font-bold">{cleaner.tasks} tareas</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>💰 Ingresos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Total:</span>
              <span className="font-bold">€{data.totalRevenue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Duración Promedio:</span>
              <span className="font-bold">{data.averageTaskDuration} min</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Re-export the new component
export { LaundryReportTable } from './LaundryReportTable';
