import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PicklistExportData {
  code: string;
  status: string;
  scheduled_date: string | null;
  created_at: string;
  notes: string | null;
  items: Array<{
    id: string;
    product_id: string;
    quantity: number;
    property_id: string | null;
    is_property_package: boolean;
    products_summary: Array<{
      quantity: number;
      product_id: string;
      product_name: string;
    }> | null;
    inventory_products: {
      name: string;
    };
    properties: {
      nombre: string;
      codigo: string;
      direccion: string;
    } | null;
  }>;
}

export const usePicklistExport = () => {
  const { toast } = useToast();

  const getPicklistData = useCallback(async (picklistId: string): Promise<PicklistExportData | null> => {
    try {
      const [picklistResponse, itemsResponse] = await Promise.all([
        supabase
          .from("logistics_picklists")
          .select("code, status, scheduled_date, created_at, notes")
          .eq("id", picklistId)
          .single(),
        supabase
          .from("logistics_picklist_items")
          .select(`
            id, product_id, quantity, property_id, is_property_package, products_summary,
            inventory_products:product_id(name),
            properties:property_id(nombre, codigo, direccion)
          `)
          .eq("picklist_id", picklistId)
      ]);

      if (picklistResponse.error || itemsResponse.error) {
        console.error('Error fetching picklist data:', picklistResponse.error || itemsResponse.error);
        return null;
      }

      return {
        ...picklistResponse.data,
        items: itemsResponse.data as any
      };
    } catch (error) {
      console.error('Error getting picklist data:', error);
      return null;
    }
  }, []);

  const exportToExcel = useCallback(async (picklistId: string, picklistCode?: string) => {
    try {
      const data = await getPicklistData(picklistId);
      if (!data) {
        toast({
          title: "❌ Error al exportar",
          description: "No se pudieron obtener los datos del picklist",
          variant: "destructive",
        });
        return;
      }

      const workbook = XLSX.utils.book_new();

      // Hoja principal con información del picklist
      const picklistInfo = [
        { Campo: 'Código', Valor: data.code },
        { Campo: 'Estado', Valor: data.status },
        { Campo: 'Fecha programada', Valor: data.scheduled_date ? format(new Date(data.scheduled_date), 'dd/MM/yyyy', { locale: es }) : '-' },
        { Campo: 'Fecha creación', Valor: format(new Date(data.created_at), 'dd/MM/yyyy HH:mm', { locale: es }) },
        { Campo: 'Notas', Valor: data.notes || '-' }
      ];

      const infoSheet = XLSX.utils.json_to_sheet(picklistInfo);
      XLSX.utils.book_append_sheet(workbook, infoSheet, 'Información');

      // Hoja con items individuales
      const individualItems = data.items
        .filter(item => !item.is_property_package)
        .map(item => ({
          'Producto': item.inventory_products.name,
          'Cantidad': item.quantity,
          'Tipo': 'Producto individual'
        }));

      if (individualItems.length > 0) {
        const itemsSheet = XLSX.utils.json_to_sheet(individualItems);
        XLSX.utils.book_append_sheet(workbook, itemsSheet, 'Productos');
      }

      // Hoja con paquetes de propiedades (apartamentos)
      const propertyPackages = data.items
        .filter(item => item.is_property_package && item.properties)
        .map(item => {
          const baseData = {
            'Código Apartamento': item.properties?.codigo || '',
            'Nombre Apartamento': item.properties?.nombre || '',
            'Dirección': item.properties?.direccion || '',
          };

          // Si hay products_summary, agregar los productos
          if (item.products_summary && item.products_summary.length > 0) {
            const materials = item.products_summary
              .map(product => `${product.quantity}x ${product.product_name}`)
              .join('; ');
            return {
              ...baseData,
              'Materiales a entregar': materials
            };
          }

          return baseData;
        });

      if (propertyPackages.length > 0) {
        const propertiesSheet = XLSX.utils.json_to_sheet(propertyPackages);
        XLSX.utils.book_append_sheet(workbook, propertiesSheet, 'Apartamentos');
      }

      // Hoja detallada con todos los materiales por apartamento
      const detailedMaterials: any[] = [];
      data.items
        .filter(item => item.is_property_package && item.properties && item.products_summary)
        .forEach(item => {
          item.products_summary?.forEach(product => {
            detailedMaterials.push({
              'Código Apartamento': item.properties?.codigo || '',
              'Nombre Apartamento': item.properties?.nombre || '',
              'Dirección': item.properties?.direccion || '',
              'Material': product.product_name,
              'Cantidad': product.quantity
            });
          });
        });

      if (detailedMaterials.length > 0) {
        const detailSheet = XLSX.utils.json_to_sheet(detailedMaterials);
        XLSX.utils.book_append_sheet(workbook, detailSheet, 'Detalle Materiales');
      }

      const filename = `picklist_${picklistCode || data.code}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      XLSX.writeFile(workbook, filename);

      toast({
        title: "✅ Exportación exitosa",
        description: `Archivo ${filename} descargado correctamente`,
      });
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast({
        title: "❌ Error al exportar",
        description: "No se pudo generar el archivo Excel",
        variant: "destructive",
      });
    }
  }, [getPicklistData, toast]);

  const exportToPDF = useCallback(async (picklistId: string, picklistCode?: string) => {
    try {
      const data = await getPicklistData(picklistId);
      if (!data) {
        toast({
          title: "❌ Error al exportar",
          description: "No se pudieron obtener los datos del picklist",
          variant: "destructive",
        });
        return;
      }

      const doc = new jsPDF();
      const pageHeight = doc.internal.pageSize.height;
      let y = 20;

      // Título
      doc.setFontSize(18);
      doc.text(`Picklist: ${data.code}`, 20, y);
      y += 15;

      // Información básica
      doc.setFontSize(12);
      doc.text(`Estado: ${data.status}`, 20, y);
      y += 8;
      doc.text(`Fecha programada: ${data.scheduled_date ? format(new Date(data.scheduled_date), 'dd/MM/yyyy', { locale: es }) : '-'}`, 20, y);
      y += 8;
      doc.text(`Creado: ${format(new Date(data.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}`, 20, y);
      y += 8;

      if (data.notes) {
        doc.text(`Notas: ${data.notes}`, 20, y);
        y += 8;
      }

      y += 10;

      // Productos individuales
      const individualItems = data.items.filter(item => !item.is_property_package);
      if (individualItems.length > 0) {
        doc.setFontSize(14);
        doc.text('Productos Individuales:', 20, y);
        y += 10;

        doc.setFontSize(10);
        individualItems.forEach(item => {
          if (y > pageHeight - 20) {
            doc.addPage();
            y = 20;
          }
          doc.text(`• ${item.quantity}x ${item.inventory_products.name}`, 25, y);
          y += 6;
        });
        y += 10;
      }

      // Apartamentos y materiales
      const propertyPackages = data.items.filter(item => item.is_property_package && item.properties);
      if (propertyPackages.length > 0) {
        if (y > pageHeight - 60) {
          doc.addPage();
          y = 20;
        }

        doc.setFontSize(14);
        doc.text('Apartamentos y Materiales:', 20, y);
        y += 10;

        propertyPackages.forEach(item => {
          if (y > pageHeight - 40) {
            doc.addPage();
            y = 20;
          }

          doc.setFontSize(12);
          doc.text(`${item.properties?.codigo} - ${item.properties?.nombre}`, 20, y);
          y += 8;

          doc.setFontSize(10);
          doc.text(`Dirección: ${item.properties?.direccion || ''}`, 25, y);
          y += 6;

          if (item.products_summary && item.products_summary.length > 0) {
            doc.text('Materiales a entregar:', 25, y);
            y += 6;

            item.products_summary.forEach(product => {
              if (y > pageHeight - 15) {
                doc.addPage();
                y = 20;
              }
              doc.text(`  • ${product.quantity}x ${product.product_name}`, 30, y);
              y += 5;
            });
          }
          y += 8;
        });
      }

      const filename = `picklist_${picklistCode || data.code}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      doc.save(filename);

      toast({
        title: "✅ Exportación exitosa",
        description: `Archivo ${filename} descargado correctamente`,
      });
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      toast({
        title: "❌ Error al exportar",
        description: "No se pudo generar el archivo PDF",
        variant: "destructive",
      });
    }
  }, [getPicklistData, toast]);

  return {
    exportToExcel,
    exportToPDF
  };
};