
import * as z from 'zod';

// Forma de los valores del formulario de cliente. Los requisitos (obligatorios,
// formato, datos fiscales) dependen de alta/edición y están en clientRules.buildClientSchema.
export const clientSchema = z.object({
  nombre: z.string(),
  cifNif: z.string(),
  telefono: z.string(),
  email: z.string(),
  direccionFacturacion: z.string(),
  codigoPostal: z.string(),
  ciudad: z.string(),
  tipoServicio: z.string(),
  metodoPago: z.string(),
  supervisor: z.string(),
  factura: z.boolean(),
  linenControlEnabled: z.boolean(),
  amenitiesControlEnabled: z.boolean(),
  photosVisibleToClient: z.boolean(),
  isActive: z.boolean(),
});

export type ClientFormData = z.infer<typeof clientSchema>;
