import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { Resend } from 'npm:resend@2.0.0';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlanningTaskEmailItem {
  propertyCode: string;
  propertyName: string;
  address: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

interface PlanningBatchEmailRequest {
  cleanerEmail: string;
  cleanerName: string;
  taskDate: string;
  tasks: PlanningTaskEmailItem[];
}

const formatDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { cleanerEmail, cleanerName, taskDate, tasks }: PlanningBatchEmailRequest = await req.json();

    if (!cleanerEmail || !cleanerName || !taskDate || !Array.isArray(tasks)) {
      return new Response(JSON.stringify({ error: 'Payload incompleto.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const htmlTasks = tasks
      .sort((a, b) => `${a.startTime}`.localeCompare(`${b.startTime}`))
      .map(
        (task) => `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 700; color: #0f172a;">${task.propertyCode}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #334155;">${task.propertyName}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #334155;">${task.startTime} - ${task.endTime}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #334155;">${task.durationMinutes} min</td>
          </tr>
        `,
      )
      .join('');

    const response = await resend.emails.send({
      from: 'LIMPATEX <noreply@limpatexgestion.com>',
      to: [cleanerEmail],
      subject: `Planificación del ${formatDate(taskDate)}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 680px; margin: 0 auto; background: #f8fafc; padding: 24px;">
          <div style="background: #ffffff; border-radius: 18px; padding: 28px; box-shadow: 0 12px 40px rgba(15, 23, 42, 0.08);">
            <p style="margin: 0; font-size: 12px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; color: #6d28d9;">
              Planificación operativa
            </p>
            <h1 style="margin: 12px 0 0; font-size: 28px; color: #0f172a;">Hola ${cleanerName}</h1>
            <p style="margin: 12px 0 24px; font-size: 15px; line-height: 1.6; color: #475569;">
              Te enviamos tu planificación agrupada para el <strong>${formatDate(taskDate)}</strong>.
            </p>

            <div style="background: #0f172a; color: white; border-radius: 16px; padding: 18px 20px; margin-bottom: 24px;">
              <p style="margin: 0; font-size: 12px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.7);">
                Resumen del día
              </p>
              <p style="margin: 12px 0 0; font-size: 26px; font-weight: 800;">${tasks.length} tareas asignadas</p>
            </div>

            <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden;">
              <thead style="background: #f8fafc;">
                <tr>
                  <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: #64748b;">Código</th>
                  <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: #64748b;">Propiedad</th>
                  <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: #64748b;">Horario</th>
                  <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: #64748b;">Duración</th>
                </tr>
              </thead>
              <tbody>
                ${htmlTasks}
              </tbody>
            </table>

            <p style="margin: 24px 0 8px; color: #334155;">Puedes acceder a tus tareas desde:</p>
            <p style="margin: 0 0 20px;">
              <a href="https://gestionlimpatex.vercel.app/" style="color: #2563eb; font-weight: 700; text-decoration: none;">
                https://gestionlimpatex.vercel.app/
              </a>
            </p>
            <p style="margin: 0; font-weight: 700; color: #0f172a;">
              Recuerda completar los reportes de todas tus tareas asignadas.
            </p>
          </div>
        </div>
      `,
    });

    return new Response(JSON.stringify({ success: true, id: response.data?.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('send-planning-batch-email error', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Error enviando email.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
