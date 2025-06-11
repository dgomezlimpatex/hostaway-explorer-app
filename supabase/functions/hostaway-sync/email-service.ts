
import { Resend } from "npm:resend@2.0.0";
import { HostawayReservation, SyncStats } from './types.ts';

const resendApiKey = Deno.env.get('RESEND_API_KEY')!;
const resend = new Resend(resendApiKey);

export async function sendCancellationEmail(reservation: HostawayReservation, property: any) {
  const emailData = {
    from: 'Sistema de Gestión <noreply@limpatex.com>',
    to: ['dgomezlimpatex@gmail.com'],
    subject: '🚨 Cancelación de Reserva - Hostaway',
    html: `
      <h2>Cancelación de Reserva</h2>
      <p><strong>Propiedad:</strong> ${property.nombre}</p>
      <p><strong>Dirección:</strong> ${property.direccion}</p>
      <p><strong>Reserva ID:</strong> ${reservation.id}</p>
      <p><strong>Fecha de llegada:</strong> ${reservation.arrivalDate}</p>
      <p><strong>Fecha de salida:</strong> ${reservation.departureDate}</p>
      <p><strong>Huésped:</strong> ${reservation.guestName}</p>
      <p><strong>Fecha de cancelación:</strong> ${reservation.cancellationDate}</p>
      
      <p>La tarea de limpieza asociada ha sido eliminada automáticamente.</p>
    `,
  };

  await resend.emails.send(emailData);
}

export async function sendSyncSummaryEmail(stats: SyncStats) {
  // Solo enviar si hay cambios significativos
  if (stats.new_reservations === 0 && stats.updated_reservations === 0 && stats.cancelled_reservations === 0) {
    console.log('No hay cambios significativos, omitiendo email resumen');
    return;
  }

  const emailData = {
    from: 'Sistema de Gestión <noreply@limpatex.com>',
    to: ['dgomezlimpatex@gmail.com'],
    subject: '📊 Resumen de Sincronización - Hostaway',
    html: `
      <h2>Resumen de Sincronización</h2>
      <p><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
      
      <h3>Estadísticas:</h3>
      <ul>
        <li><strong>Reservas procesadas:</strong> ${stats.reservations_processed}</li>
        <li><strong>Nuevas reservas:</strong> ${stats.new_reservations}</li>
        <li><strong>Reservas actualizadas:</strong> ${stats.updated_reservations}</li>
        <li><strong>Reservas canceladas:</strong> ${stats.cancelled_reservations}</li>
        <li><strong>Tareas creadas:</strong> ${stats.tasks_created}</li>
      </ul>
      
      ${stats.errors.length > 0 ? `
        <h3>Errores:</h3>
        <ul>
          ${stats.errors.map(error => `<li>${error}</li>`).join('')}
        </ul>
      ` : '<p>✅ No se encontraron errores</p>'}
    `,
  };

  await resend.emails.send(emailData);
}
