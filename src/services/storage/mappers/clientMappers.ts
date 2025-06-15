
import { Client, CreateClientData } from '@/types/client';

export const mapClientFromDB = (row: any): Client => ({
  id: row.id,
  created_at: row.created_at,
  updated_at: row.updated_at,
  nombre: row.nombre,
  cifNif: row.cif_nif,
  telefono: row.telefono,
  email: row.email,
  direccionFacturacion: row.direccion_facturacion,
  codigoPostal: row.codigo_postal,
  ciudad: row.ciudad,
  tipoServicio: row.tipo_servicio as Client['tipoServicio'],
  metodoPago: row.metodo_pago as Client['metodoPago'],
  supervisor: row.supervisor,
  factura: row.factura,
  fechaCreacion: row.fecha_creacion,
  fechaActualizacion: row.fecha_actualizacion
});

export const mapClientToDB = (client: Partial<CreateClientData>): any => {
  const updateData: any = {};
  
  if (client.nombre !== undefined) updateData.nombre = client.nombre;
  if (client.cifNif !== undefined) updateData.cif_nif = client.cifNif;
  if (client.telefono !== undefined) updateData.telefono = client.telefono;
  if (client.email !== undefined) updateData.email = client.email;
  if (client.direccionFacturacion !== undefined) updateData.direccion_facturacion = client.direccionFacturacion;
  if (client.codigoPostal !== undefined) updateData.codigo_postal = client.codigoPostal;
  if (client.ciudad !== undefined) updateData.ciudad = client.ciudad;
  if (client.tipoServicio !== undefined) updateData.tipo_servicio = client.tipoServicio;
  if (client.metodoPago !== undefined) updateData.metodo_pago = client.metodoPago;
  if (client.supervisor !== undefined) updateData.supervisor = client.supervisor;
  if (client.factura !== undefined) updateData.factura = client.factura;

  return updateData;
};
