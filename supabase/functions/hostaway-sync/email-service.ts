
import { Resend } from "npm:resend@2.0.0";
import { HostawayReservation, SyncStats } from './types.ts';

const resendApiKey = Deno.env.get('RESEND_API_KEY')!;
const resend = new Resend(resendApiKey);

export async function sendCancellationEmail(reservation: HostawayReservation, property: any) {
  const emailData = {
    from: 'Sistema de Gestión <noreply@limpatexgestion.com>',
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
  // Send summary email ALWAYS (even when no changes)
  console.log('Sending sync summary email (always send policy)');

  const hasChanges = stats.new_reservations > 0 || 
                    stats.updated_reservations > 0 || 
                    stats.cancelled_reservations > 0 || 
                    stats.tasks_created > 0 ||
                    stats.errors.length > 0;

  const statusIcon = stats.errors.length > 0 ? '🚨' : (hasChanges ? '✅' : 'ℹ️');
  const statusText = stats.errors.length > 0 ? 'CON ERRORES' : (hasChanges ? 'EXITOSA' : 'SIN CAMBIOS');

  const emailData = {
    from: 'Sistema de Gestión <noreply@limpatexgestion.com>',
    to: ['dgomezlimpatex@gmail.com'],
    subject: `${statusIcon} Resumen de Sincronización ${statusText} - Hostaway`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">${statusIcon} Sincronización ${statusText}</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Hostaway - ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</p>
        </div>
        
        <div style="background: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0;">
          <div style="background: white; border-radius: 6px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h3 style="color: #1e40af; margin-top: 0;">📊 Resumen de la Sincronización</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; margin: 20px 0;">
              <div style="text-align: center; padding: 15px; background: #f1f5f9; border-radius: 6px;">
                <div style="font-size: 24px; font-weight: bold; color: #475569;">${stats.reservations_processed}</div>
                <div style="font-size: 12px; color: #64748b; margin-top: 5px;">Reservas Procesadas</div>
              </div>
              <div style="text-align: center; padding: 15px; background: #dcfce7; border-radius: 6px;">
                <div style="font-size: 24px; font-weight: bold; color: #16a34a;">${stats.new_reservations}</div>
                <div style="font-size: 12px; color: #15803d; margin-top: 5px;">Nuevas Reservas</div>
              </div>
              <div style="text-align: center; padding: 15px; background: #fef3c7; border-radius: 6px;">
                <div style="font-size: 24px; font-weight: bold; color: #d97706;">${stats.updated_reservations}</div>
                <div style="font-size: 12px; color: #92400e; margin-top: 5px;">Reservas Actualizadas</div>
              </div>
              <div style="text-align: center; padding: 15px; background: #fee2e2; border-radius: 6px;">
                <div style="font-size: 24px; font-weight: bold; color: #dc2626;">${stats.cancelled_reservations}</div>
                <div style="font-size: 12px; color: #991b1b; margin-top: 5px;">Reservas Canceladas</div>
              </div>
              <div style="text-align: center; padding: 15px; background: #e0e7ff; border-radius: 6px;">
                <div style="font-size: 24px; font-weight: bold; color: #3730a3;">${stats.tasks_created}</div>
                <div style="font-size: 12px; color: #312e81; margin-top: 5px;">Tareas Creadas</div>
              </div>
            </div>
            ${!hasChanges ? `
            <div style="background: #f0f9ff; border: 1px solid #0284c7; border-radius: 6px; padding: 12px; margin-top: 15px;">
              <strong>ℹ️ Sin cambios detectados:</strong> No se encontraron nuevas reservas, actualizaciones o cancelaciones en esta sincronización.
            </div>
            ` : ''}
          </div>
          
          ${stats.errors.length > 0 ? `
          <div style="background: white; border-radius: 6px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-left: 4px solid #dc2626;">
            <h3 style="color: #dc2626; margin-top: 0;">🚨 Errores Detectados</h3>
            <ul style="margin: 0; padding-left: 20px;">
              ${stats.errors.map(error => `<li style="margin: 5px 0; color: #374151;">${error}</li>`).join('')}
            </ul>
          </div>
          ` : `
          <div style="background: white; border-radius: 6px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-left: 4px solid #16a34a;">
            <h3 style="color: #16a34a; margin-top: 0;">✅ Sincronización Exitosa</h3>
            <p style="margin: 0; color: #374151;">La sincronización se completó sin errores.</p>
          </div>
          `}
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <p style="font-size: 12px; color: #64748b; margin: 0;">
              Este email fue enviado automáticamente por el sistema de gestión de limpieza.<br/>
              Próxima sincronización automática según horario configurado.
            </p>
          </div>
        </div>
      </div>
    `,
  };

  await resend.emails.send(emailData);
}
