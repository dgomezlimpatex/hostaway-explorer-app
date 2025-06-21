
import { SyncStats } from './types.ts';

export class ResponseBuilder {
  static buildSuccessResponse(
    stats: SyncStats,
    cancellationSummary: string,
    startDate: string,
    endDate: string,
    totalReservations: number
  ) {
    return {
      success: true,
      message: 'Sincronización corregida completada exitosamente',
      stats,
      cancellationSummary,
      optimization: {
        dateRange: `${startDate} a ${endDate}`,
        totalReservations,
        corrections: [
          'Solo búsqueda por departureDate (fecha de salida)',
          'Rango optimizado: HOY + 14 días (sin días pasados)',
          'Detección manual de tareas duplicadas (corregida)',
          'Resumen detallado de cancelaciones'
        ]
      }
    };
  }

  static buildErrorResponse(error: Error, stats?: SyncStats) {
    return {
      success: false,
      error: error.message,
      stats: stats || undefined
    };
  }

  static buildCriticalErrorResponse(error: Error) {
    return {
      success: false,
      error: error.message
    };
  }
}
