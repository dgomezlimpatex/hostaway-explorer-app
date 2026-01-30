import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TaskInput {
  property: string;
  address: string;
  date: string;
  startTime: string;
  endTime: string;
  type: string;
  status: string;
  checkIn: string;
  checkOut: string;
  clienteId: string;
  propertyId: string;
  duration: number;
  cost: number;
  paymentMethod: string;
  supervisor: string;
  cleanerId?: string;
  cleanerName?: string;
  cleanerEmail?: string;
}

interface BatchCreateRequest {
  tasks: TaskInput[];
  sedeId: string;
  sendEmails: boolean;
}

interface BatchCreateResponse {
  success: boolean;
  created: number;
  taskIds: string[];
  emailsSent: number;
  errors?: Array<{ index: number; error: string }>;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { tasks, sedeId, sendEmails }: BatchCreateRequest = await req.json();

    console.log(`📦 Batch creating ${tasks.length} tasks for sede ${sedeId}`);

    if (!tasks || tasks.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "No tasks provided" 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (tasks.length > 50) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Maximum 50 tasks per batch" 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Prepare tasks for batch insert
    const tasksToInsert = tasks.map(task => ({
      property: task.property,
      address: task.address,
      date: task.date,
      start_time: task.startTime,
      end_time: task.endTime,
      type: task.type,
      status: task.status,
      check_in: task.checkIn,
      check_out: task.checkOut,
      cliente_id: task.clienteId,
      property_id: task.propertyId,
      duration: task.duration,
      cost: task.cost,
      payment_method: task.paymentMethod,
      supervisor: task.supervisor,
      cleaner_id: task.cleanerId || null,
      cleaner: task.cleanerName || null,
      sede_id: sedeId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    // Batch INSERT all tasks
    const { data: createdTasks, error: insertError } = await supabase
      .from('tasks')
      .insert(tasksToInsert)
      .select('id, property, cleaner_id, cleaner, date, start_time, end_time, address');

    if (insertError) {
      console.error('❌ Batch insert failed:', insertError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: insertError.message 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`✅ Successfully created ${createdTasks.length} tasks`);

    const taskIds = createdTasks.map(t => t.id);
    let emailsSent = 0;

    // Send consolidated emails if requested
    if (sendEmails) {
      // Group tasks by cleaner
      const cleanerTasksMap: Record<string, { 
        cleanerId: string; 
        cleanerName: string;
        email: string;
        tasks: Array<{ property: string; date: string; startTime: string; endTime: string; address: string }> 
      }> = {};

      // Match created tasks with input tasks to get cleaner email
      for (let i = 0; i < createdTasks.length; i++) {
        const createdTask = createdTasks[i];
        const inputTask = tasks[i];

        if (createdTask.cleaner_id && inputTask.cleanerEmail) {
          const cleanerId = createdTask.cleaner_id;
          
          if (!cleanerTasksMap[cleanerId]) {
            cleanerTasksMap[cleanerId] = {
              cleanerId,
              cleanerName: createdTask.cleaner || '',
              email: inputTask.cleanerEmail,
              tasks: []
            };
          }
          
          cleanerTasksMap[cleanerId].tasks.push({
            property: createdTask.property,
            date: createdTask.date,
            startTime: createdTask.start_time,
            endTime: createdTask.end_time,
            address: createdTask.address
          });
        }
      }

      // Send one consolidated email per cleaner
      for (const [cleanerId, data] of Object.entries(cleanerTasksMap)) {
        try {
          const tasksList = data.tasks.map(t => {
            const taskDate = new Date(t.date);
            const formattedDate = taskDate.toLocaleDateString('es-ES', { 
              weekday: 'long', 
              day: 'numeric',
              month: 'long'
            });
            return `<li style="margin-bottom: 10px;"><strong>${t.property}</strong> - ${formattedDate} (${t.startTime} - ${t.endTime})</li>`;
          }).join('');

          await resend.emails.send({
            from: "Sistema de Gestión <noreply@limpatexgestion.com>",
            to: [data.email],
            subject: `📋 ${data.tasks.length} Nuevas Tareas Asignadas`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                  <h2 style="color: #2563eb; margin-bottom: 20px;">📋 Nuevas Tareas Asignadas</h2>
                  
                  <p style="font-size: 16px; margin-bottom: 20px;">Hola <strong>${data.cleanerName}</strong>,</p>
                  
                  <p style="margin-bottom: 20px;">Se te han asignado <strong>${data.tasks.length} nuevas tareas</strong> de limpieza:</p>
                  
                  <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h3 style="color: #374151; margin-top: 0; margin-bottom: 15px;">Lista de Tareas</h3>
                    <ul style="list-style: none; padding: 0; margin: 0;">
                      ${tasksList}
                    </ul>
                  </div>
                  
                  <div style="background-color: #ecfdf5; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #10b981;">
                    <h4 style="color: #065f46; margin-top: 0; margin-bottom: 10px;">✅ Próximos Pasos:</h4>
                    <ul style="color: #065f46; margin: 0; padding-left: 20px;">
                      <li>Revisa los detalles de cada tarea</li>
                      <li>Confirma tu disponibilidad</li>
                      <li>Prepara los materiales necesarios</li>
                    </ul>
                  </div>
                  
                  <p style="margin-bottom: 20px;">Si tienes alguna pregunta, por favor contacta con tu supervisor.</p>
                  
                  <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 14px; margin: 0;">
                      Este email fue enviado automáticamente por el Sistema de Gestión de Limpieza
                    </p>
                  </div>
                </div>
              </div>
            `,
          });

          emailsSent++;
          console.log(`📧 Sent consolidated email to ${data.email} with ${data.tasks.length} tasks`);
        } catch (emailError) {
          console.error(`Failed to send email to ${data.email}:`, emailError);
        }
      }
    }

    const response: BatchCreateResponse = {
      success: true,
      created: createdTasks.length,
      taskIds,
      emailsSent
    };

    console.log(`🎉 Batch complete: ${createdTasks.length} tasks created, ${emailsSent} emails sent`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("❌ Batch create error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        details: error.toString()
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
