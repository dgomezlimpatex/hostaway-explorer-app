
import * as z from 'zod';

export const propertySchema = z.object({
  codigo: z.string().min(1, 'El código es obligatorio'),
  nombre: z.string().min(1, 'El nombre es obligatorio'),
  direccion: z.string().min(1, 'La dirección es obligatoria'),
  numeroCamas: z.number().min(1, 'Debe tener al menos 1 cama'),
  numeroBanos: z.number().min(1, 'Debe tener al menos 1 baño'),
  duracionServicio: z.number().min(15, 'La duración mínima es 15 minutos'),
  costeServicio: z.number().min(0, 'El coste debe ser positivo'),
  numeroSabanas: z.number().min(0, 'El número de sábanas debe ser positivo'),
  numeroToallasGrandes: z.number().min(0, 'El número de toallas grandes debe ser positivo'),
  numeroTotallasPequenas: z.number().min(0, 'El número de toallas pequeñas debe ser positivo'),
  numeroAlfombrines: z.number().min(0, 'El número de alfombrines debe ser positivo'),
  clienteId: z.string().min(1, 'Debe seleccionar un cliente'),
});

export type PropertyFormData = z.infer<typeof propertySchema>;
