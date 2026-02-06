import { SyncStats } from './types.ts';

export class ResponseBuilder {
  static buildSuccessResponse(
    stats: SyncStats,
    startDate: string,
    endDate: string,
    totalReservations: number
  ) {
    return {
      success: true,
      message: 'Sincronización con Avantio completada exitosamente',
      dateRange: { start: startDate, end: endDate },
      stats: {
        reservationsProcessed: stats.reservations_processed,
        newReservations: stats.new_reservations,
        updatedReservations: stats.updated_reservations,
        cancelledReservations: stats.cancelled_reservations,
        tasksCreated: stats.tasks_created,
        tasksCancelled: stats.tasks_cancelled,
        tasksModified: stats.tasks_modified,
        errorsCount: stats.errors.length
      },
      details: {
        tasks: stats.tasks_details,
        tasksCancelled: stats.tasks_cancelled_details,
        tasksModified: stats.tasks_modified_details,
        reservations: stats.reservations_details
      },
      errors: stats.errors.length > 0 ? stats.errors : null,
      timestamp: new Date().toISOString()
    };
  }

  static buildErrorResponse(error: Error, stats: SyncStats) {
    return {
      success: false,
      message: 'Error durante la sincronización con Avantio',
      error: error.message,
      stats: {
        reservationsProcessed: stats.reservations_processed,
        newReservations: stats.new_reservations,
        updatedReservations: stats.updated_reservations,
        cancelledReservations: stats.cancelled_reservations,
        tasksCreated: stats.tasks_created,
        tasksCancelled: stats.tasks_cancelled,
        tasksModified: stats.tasks_modified,
        errorsCount: stats.errors.length
      },
      allErrors: stats.errors,
      timestamp: new Date().toISOString()
    };
  }

  static buildCriticalErrorResponse(error: Error) {
    return {
      success: false,
      message: 'Error crítico en la sincronización con Avantio',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }

  static buildConfigurationErrorResponse() {
    return {
      success: false,
      message: 'Avantio no está configurado',
      error: 'Falta el token de API de Avantio. Por favor, configura AVANTIO_API_TOKEN en los secretos de Supabase.',
      requiredSecrets: [
        'AVANTIO_API_TOKEN - Token de autenticación de la API de Avantio PMS v1'
      ],
      timestamp: new Date().toISOString()
    };
  }
}
