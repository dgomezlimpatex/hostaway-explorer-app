
import * as z from 'zod';

export const clientSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio'),
  cifNif: z.string().min(1, 'El CIF/NIF es obligatorio'),
  telefono: z.string().min(1, 'El teléfono es obligatorio'),
  email: z.string().email('Email inválido'),
  direccionFacturacion: z.string().min(1, 'La dirección es obligatoria'),
  codigoPostal: z.string().min(1, 'El código postal es obligatorio'),
  ciudad: z.string().min(1, 'La ciudad es obligatoria'),
  tipoServicio: z.enum(['mantenimiento', 'cristaleria', 'airbnb', 'otro']),
  metodoPago: z.enum(['transferencia', 'efectivo', 'bizum']),
  supervisor: z.string().min(1, 'El supervisor es obligatorio'),
  factura: z.boolean(),
});

export type ClientFormData = z.infer<typeof clientSchema>;
