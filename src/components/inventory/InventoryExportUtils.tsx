import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FileText, Download, FileSpreadsheet } from "lucide-react";
import { useInventoryStock, useInventoryMovements } from '@/hooks/useInventory';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function InventoryExportUtils() {
  const { data: stock = [] } = useInventoryStock();
  const { data: movements = [] } = useInventoryMovements();
  const { toast } = useToast();

  const exportToExcel = (type: 'stock' | 'movements') => {
    try {
      let data: any[] = [];
      let filename = '';

      if (type === 'stock') {
        data = stock.map(item => ({
          'Producto': item.product?.name || '',
          'Categoría': item.product?.category?.name || '',
          'Stock Actual': item.current_quantity,
          'Stock Mínimo': item.minimum_stock,
          'Stock Máximo': item.maximum_stock,
          'Costo por Unidad': item.cost_per_unit || 0,
          'Valor Total': (item.current_quantity * (item.cost_per_unit || 0)).toFixed(2),
          'Estado': item.current_quantity === 0 ? 'Crítico' : 
                   item.current_quantity <= item.minimum_stock ? 'Bajo' : 'Normal',
          'Última Actualización': format(new Date(item.last_updated), 'dd/MM/yyyy HH:mm', { locale: es })
        }));
        filename = `inventario_stock_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      } else {
        data = movements.map(movement => ({
          'Fecha': format(new Date(movement.created_at), 'dd/MM/yyyy HH:mm', { locale: es }),
          'Producto': movement.product?.name || '',
          'Tipo': movement.movement_type === 'entrada' ? 'Entrada' : 'Salida',
          'Cantidad': movement.quantity,
          'Stock Anterior': movement.previous_quantity,
          'Stock Nuevo': movement.new_quantity,
          'Motivo': movement.reason,
          'Propiedad': movement.property?.nombre || '',
          'Tarea': movement.task_id || ''
        }));
        filename = `inventario_movimientos_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      }

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, type === 'stock' ? 'Stock' : 'Movimientos');
      XLSX.writeFile(wb, filename);

      toast({
        title: "✅ Exportación exitosa",
        description: `Archivo ${filename} descargado correctamente`,
      });
    } catch (error) {
      toast({
        title: "❌ Error al exportar",
        description: "No se pudo generar el archivo Excel",
        variant: "destructive",
      });
    }
  };

  const exportToPDF = (type: 'stock' | 'movements') => {
    try {
      const doc = new jsPDF();
      const pageHeight = doc.internal.pageSize.height;
      let y = 20;

      // Título
      doc.setFontSize(16);
      doc.text(type === 'stock' ? 'Reporte de Stock de Inventario' : 'Reporte de Movimientos de Inventario', 20, y);
      y += 10;

      // Fecha
      doc.setFontSize(10);
      doc.text(`Generado el: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}`, 20, y);
      y += 20;

      doc.setFontSize(8);

      if (type === 'stock') {
        // Headers
        doc.text('Producto', 20, y);
        doc.text('Categoría', 70, y);
        doc.text('Actual', 120, y);
        doc.text('Mín', 140, y);
        doc.text('Estado', 160, y);
        y += 10;

        // Data
        stock.forEach((item) => {
          if (y > pageHeight - 20) {
            doc.addPage();
            y = 20;
          }

          const productName = (item.product?.name || '').substring(0, 25);
          const categoryName = (item.product?.category?.name || '').substring(0, 20);
          const estado = item.current_quantity === 0 ? 'Crítico' : 
                        item.current_quantity <= item.minimum_stock ? 'Bajo' : 'Normal';

          doc.text(productName, 20, y);
          doc.text(categoryName, 70, y);
          doc.text(item.current_quantity.toString(), 120, y);
          doc.text(item.minimum_stock.toString(), 140, y);
          doc.text(estado, 160, y);
          y += 6;
        });
      } else {
        // Headers
        doc.text('Fecha', 20, y);
        doc.text('Producto', 50, y);
        doc.text('Tipo', 100, y);
        doc.text('Cant', 120, y);
        doc.text('Motivo', 140, y);
        y += 10;

        // Data (últimos 50 movimientos)
        movements.slice(0, 50).forEach((movement) => {
          if (y > pageHeight - 20) {
            doc.addPage();
            y = 20;
          }

          const fecha = format(new Date(movement.created_at), 'dd/MM', { locale: es });
          const productName = (movement.product?.name || '').substring(0, 20);
          const tipo = movement.movement_type === 'entrada' ? 'Entrada' : 'Salida';
          const motivo = movement.reason.substring(0, 20);

          doc.text(fecha, 20, y);
          doc.text(productName, 50, y);
          doc.text(tipo, 100, y);
          doc.text(movement.quantity.toString(), 120, y);
          doc.text(motivo, 140, y);
          y += 6;
        });
      }

      const filename = type === 'stock' ? 
        `inventario_stock_${format(new Date(), 'yyyy-MM-dd')}.pdf` :
        `inventario_movimientos_${format(new Date(), 'yyyy-MM-dd')}.pdf`;

      doc.save(filename);

      toast({
        title: "✅ Exportación exitosa",
        description: `Archivo ${filename} descargado correctamente`,
      });
    } catch (error) {
      toast({
        title: "❌ Error al exportar",
        description: "No se pudo generar el archivo PDF",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exportar Stock
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => exportToExcel('stock')}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Exportar a Excel
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => exportToPDF('stock')}>
            <FileText className="h-4 w-4 mr-2" />
            Exportar a PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exportar Movimientos
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => exportToExcel('movements')}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Exportar a Excel
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => exportToPDF('movements')}>
            <FileText className="h-4 w-4 mr-2" />
            Exportar a PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}