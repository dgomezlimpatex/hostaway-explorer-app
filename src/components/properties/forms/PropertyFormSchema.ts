
import * as z from 'zod';

export const propertySchema = z.object({
  codigo: z.string().optional().default(''),
  nombre: z.string().min(1, 'El nombre es obligatorio'),
  direccion: z.string().min(1, 'La dirección es obligatoria'),
  numeroCamas: z.number().min(0, 'El número de camas debe ser positivo'),
  numeroCamasPequenas: z.number().min(0, 'El número de camas pequeñas debe ser positivo'),
  numeroCamasSuite: z.number().min(0, 'El número de camas suite debe ser positivo'),
  numeroSofasCama: z.number().min(0, 'El número de sofás cama debe ser positivo'),
  numeroBanos: z.number().min(1, 'Debe tener al menos 1 baño'),
  duracionServicio: z.number().min(15, 'La duración mínima es 15 minutos'),
  costeServicio: z.number().min(0, 'El coste debe ser positivo'),
  checkInPredeterminado: z.string().min(1, 'El check-in es obligatorio'),
  checkOutPredeterminado: z.string().min(1, 'El check-out es obligatorio'),
  numeroSabanas: z.number().min(0, 'El número de sábanas debe ser positivo'),
  numeroSabanasRequenas: z.number().min(0, 'El número de sábanas pequeñas debe ser positivo'),
  numeroSabanasSuite: z.number().min(0, 'El número de sábanas suite debe ser positivo'),
  numeroToallasGrandes: z.number().min(0, 'El número de toallas grandes debe ser positivo'),
  numeroTotallasPequenas: z.number().min(0, 'El número de toallas pequeñas debe ser positivo'),
  numeroAlfombrines: z.number().min(0, 'El número de alfombrines debe ser positivo'),
  numeroFundasAlmohada: z.number().min(0, 'El número de fundas de almohada debe ser positivo'),
  kitAlimentario: z.number().min(0, 'El número de kits alimentarios debe ser positivo'),
  amenitiesBano: z.number().min(0, 'El número de amenities de baño debe ser positivo'),
  amenitiesCocina: z.number().min(0, 'El número de amenities de cocina debe ser positivo'),
  cantidadRollosPapelHigienico: z.number().min(0, 'La cantidad de rollos de papel higiénico debe ser positiva'),
  cantidadRollosPapelCocina: z.number().min(0, 'La cantidad de rollos de papel de cocina debe ser positiva'),
  notas: z.string().optional(),
  clienteId: z.string().min(1, 'Debe seleccionar un cliente'),
  linenControlEnabled: z.boolean().nullable().optional(),
  isActive: z.boolean().nullable().optional(),
});

export type PropertyFormData = z.infer<typeof propertySchema>;
