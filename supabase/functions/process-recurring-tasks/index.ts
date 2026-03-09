import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log("🔄 Starting recurring tasks processing...");
    
    const today = new Date().toISOString().split('T')[0];
    
    // Get all active recurring tasks that are due for execution (using snake_case DB columns)
    const { data: recurringTasks, error: fetchError } = await supabase
      .from('recurring_tasks')
      .select('*, properties:propiedad_id(nombre, direccion)')
      .eq('is_active', true)
      .lte('next_execution', today);

    if (fetchError) {
      console.error("❌ Error fetching recurring tasks:", fetchError);
      throw fetchError;
    }

    console.log(`📋 Found ${recurringTasks?.length || 0} tasks to process`);

    if (!recurringTasks || recurringTasks.length === 0) {
      return new Response(JSON.stringify({ 
        message: "No recurring tasks to process",
        processed: 0,
        generatedTasks: [],
        updatedRecurringTasks: 0
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const generatedTasks: any[] = [];
    const updatedTasks: string[] = [];

    for (const rt of recurringTasks) {
      try {
        console.log(`🔨 Processing task: ${rt.name}`);

        // Resolve property name and address from the joined relation
        const propertyName = rt.properties?.nombre || rt.name;
        const propertyAddress = rt.properties?.direccion || '';

        // Create the new task using correct snake_case column names for the tasks table
        const { data: newTask, error: createError } = await supabase
          .from('tasks')
          .insert({
            property: propertyName,
            address: propertyAddress,
            date: rt.next_execution,
            start_time: rt.start_time,
            end_time: rt.end_time,
            type: rt.type,
            status: 'pending',
            check_out: rt.check_out,
            check_in: rt.check_in,
            cleaner: rt.cleaner,
            cleaner_id: rt.cleaner_id,
            cliente_id: rt.cliente_id,
            propiedad_id: rt.propiedad_id,
            duracion: rt.duracion,
            coste: rt.coste,
            metodo_pago: rt.metodo_pago,
            supervisor: rt.supervisor,
            sede_id: rt.sede_id,
            background_color: '#3B82F6',
            notes: `Generada automáticamente desde tarea recurrente: ${rt.name}`
          })
          .select()
          .single();

        if (createError) {
          console.error(`❌ Error creating task for ${rt.name}:`, createError);
          
          // Log execution error
          await supabase.from('recurring_task_executions').insert({
            recurring_task_id: rt.id,
            execution_date: rt.next_execution,
            success: false,
            error_message: createError.message
          });
          continue;
        }

        generatedTasks.push({ id: newTask.id, name: propertyName });

        // Log successful execution
        await supabase.from('recurring_task_executions').insert({
          recurring_task_id: rt.id,
          execution_date: rt.next_execution,
          success: true,
          generated_task_id: newTask.id
        });

        // Send email notification to assigned cleaner
        if (rt.cleaner_id) {
          try {
            // Fetch cleaner email from DB
            const { data: cleanerData } = await supabase
              .from('cleaners')
              .select('name, email')
              .eq('id', rt.cleaner_id)
              .single();

            if (cleanerData?.email) {
              const emailPayload = {
                cleanerEmail: cleanerData.email,
                cleanerName: cleanerData.name || 'Trabajador',
                taskData: {
                  property: propertyName,
                  address: propertyAddress,
                  date: rt.next_execution,
                  startTime: rt.start_time,
                  endTime: rt.end_time,
                  type: rt.type,
                  recurringTaskName: rt.name,
                },
              };

              const emailRes = await fetch(
                `${supabaseUrl}/functions/v1/send-recurring-task-email`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                  },
                  body: JSON.stringify(emailPayload),
                }
              );

              if (!emailRes.ok) {
                const errText = await emailRes.text();
                console.error(`⚠️ Email send failed for ${cleanerData.email}:`, errText);
              } else {
                console.log(`📧 Email sent to ${cleanerData.email} for task ${rt.name}`);
              }
            } else {
              console.log(`⚠️ No email found for cleaner ${rt.cleaner_id}, skipping notification`);
            }
          } catch (emailError: any) {
            console.error(`⚠️ Error sending email for task ${rt.name}:`, emailError.message);
            // Don't fail the whole process if email fails
          }
        }

        // Calculate next execution date
        const nextExecution = calculateNextExecution(rt);
        
        // Check if task should be deactivated (past end date)
        const shouldDeactivate = rt.end_date && 
          new Date(nextExecution) > new Date(rt.end_date);

        // Update the recurring task with snake_case columns
        const { error: updateError } = await supabase
          .from('recurring_tasks')
          .update({
            last_execution: rt.next_execution,
            next_execution: shouldDeactivate ? '2099-12-31' : nextExecution,
            is_active: !shouldDeactivate
          })
          .eq('id', rt.id);

        if (updateError) {
          console.error(`❌ Error updating recurring task ${rt.name}:`, updateError);
        } else {
          updatedTasks.push(rt.id);
          console.log(`✅ Task ${rt.name} processed successfully`);
          
          if (shouldDeactivate) {
            console.log(`🔚 Task ${rt.name} deactivated - reached end date`);
          }
        }

      } catch (taskError: any) {
        console.error(`❌ Error processing task ${rt.name}:`, taskError);
      }
    }

    console.log(`✨ Processing complete. Generated ${generatedTasks.length} tasks, updated ${updatedTasks.length} recurring tasks`);

    return new Response(JSON.stringify({
      message: "Recurring tasks processed successfully",
      processed: generatedTasks.length,
      generatedTasks,
      updatedRecurringTasks: updatedTasks.length
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("❌ Error in process-recurring-tasks function:", error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: "Failed to process recurring tasks"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

function calculateNextExecution(task: any): string {
  const lastDate = new Date(task.next_execution);
  const nextDate = new Date(lastDate);
  const interval = task.interval_days || 1;

  switch (task.frequency) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + interval);
      break;
      
    case 'weekly':
      if (task.days_of_week && task.days_of_week.length > 0) {
        let daysAdded = 0;
        const maxDays = 14;
        
        do {
          daysAdded++;
          nextDate.setDate(nextDate.getDate() + 1);
        } while (
          !task.days_of_week.includes(nextDate.getDay()) && 
          daysAdded < maxDays
        );
      } else {
        nextDate.setDate(nextDate.getDate() + (7 * interval));
      }
      break;
      
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + interval);
      
      if (task.day_of_month) {
        const lastDayOfMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
        const targetDay = Math.min(task.day_of_month, lastDayOfMonth);
        nextDate.setDate(targetDay);
      }
      break;
  }

  return nextDate.toISOString().split('T')[0];
}

serve(handler);
