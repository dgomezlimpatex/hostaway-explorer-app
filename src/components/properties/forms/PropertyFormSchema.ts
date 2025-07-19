
import * as z from 'zod';

export const propertySchema = z.object({
  codigo: z.string().min(1, 'El código es obligatorio'),
  nombre: z.string().min(1, 'El nombre es obligatorio'),
  direccion: z.string().min(1, 'La dirección es obligatoria'),
  numeroCamas: z.number().min(1, 'Debe tener al menos 1 cama'),
  numeroBanos: z.number().min(1, 'Debe tener al menos 1 baño'),
  duracionServicio: z.number().min(15, 'La duración mínima es 15 minutos'),
  costeServicio: z.number().min(0, 'El coste debe ser positivo'),
  checkInPredeterminado: z.string().min(1, 'El check-in es obligatorio'),
  checkOutPredeterminado: z.string().min(1, 'El check-out es obligatorio'),
  numeroSabanas: z.number().min(0, 'El número de sábanas debe ser positivo'),
  numeroToallasGrandes: z.number().min(0, 'El número de toallas grandes debe ser positivo'),
  numeroTotallasPequenas: z.number().min(0, 'El número de toallas pequeñas debe ser positivo'),
  numeroAlfombrines: z.number().min(0, 'El número de alfombrines debe ser positivo'),
  numeroFundasAlmohada: z.number().min(0, 'El número de fundas de almohada debe ser positivo'),
  kitAlimentario: z.number().min(0, 'El número de kits alimentarios debe ser positivo'),
  
  // Amenities de baño
  jabonLiquido: z.number().min(0, 'El número de jabones líquidos debe ser positivo'),
  gelDucha: z.number().min(0, 'El número de geles de ducha debe ser positivo'),
  champu: z.number().min(0, 'El número de champús debe ser positivo'),
  acondicionador: z.number().min(0, 'El número de acondicionadores debe ser positivo'),
  papelHigienico: z.number().min(0, 'El número de rollos de papel higiénico debe ser positivo'),
  ambientadorBano: z.number().min(0, 'El número de ambientadores debe ser positivo'),
  desinfectanteBano: z.number().min(0, 'El número de desinfectantes debe ser positivo'),
  
  // Amenities de cocina
  aceite: z.number().min(0, 'El número de aceites debe ser positivo'),
  sal: z.number().min(0, 'El número de sales debe ser positivo'),
  azucar: z.number().min(0, 'El número de azúcares debe ser positivo'),
  vinagre: z.number().min(0, 'El número de vinagres debe ser positivo'),
  detergenteLavavajillas: z.number().min(0, 'El número de detergentes debe ser positivo'),
  limpiacristales: z.number().min(0, 'El número de limpiacristales debe ser positivo'),
  bayetasCocina: z.number().min(0, 'El número de bayetas debe ser positivo'),
  estropajos: z.number().min(0, 'El número de estropajos debe ser positivo'),
  bolsasBasura: z.number().min(0, 'El número de bolsas de basura debe ser positivo'),
  papelCocina: z.number().min(0, 'El número de rollos de papel de cocina debe ser positivo'),
  notas: z.string().optional(),
  clienteId: z.string().min(1, 'Debe seleccionar un cliente'),
});

export type PropertyFormData = z.infer<typeof propertySchema>;
