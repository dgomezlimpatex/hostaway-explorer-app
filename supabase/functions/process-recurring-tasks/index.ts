import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import {
  calculateDueExecutions,
  calculateNextExecution,
  getMadridDateKey,
} from '../_shared/recurringSchedule.ts';
import {
  assertAdminManagerOrServiceRole,
  authorizationErrorResponse,
} from '../_shared/edgeAuthorization.ts';

const MAX_OCCURRENCES_PER_TASK = 31;

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
    const recurringCronSecret = Deno.env.get('RECURRING_TASKS_CRON_SECRET') ?? '';
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    await assertAdminManagerOrServiceRole(req, supabase, supabaseServiceKey, {
      dedicatedSecret: {
        headerName: 'X-Cron-Secret',
        value: recurringCronSecret,
        actorKind: 'cron',
      },
    });
    
    console.log("🔄 Starting recurring tasks processing...");
    
    const today = getMadridDateKey();
    
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
    const updatedTasks = new Set<string>();
    const failures: Array<{ recurringTaskId: string; executionDate: string; error: string }> = [];
    let hasBacklog = false;

    for (const rt of recurringTasks) {
      try {
        console.log(`🔨 Processing task: ${rt.name}`);

        const propertyName = rt.properties?.nombre || rt.name;
        const propertyAddress = rt.properties?.direccion || '';
        const scheduleSnapshot = {
          frequency: rt.frequency,
          interval_days: rt.interval_days,
          days_of_week: rt.days_of_week,
          day_of_month: rt.day_of_month,
          start_date: rt.start_date,
          end_date: rt.end_date,
        };
        const dueExecutions = calculateDueExecutions(
          rt,
          rt.next_execution,
          today,
          MAX_OCCURRENCES_PER_TASK,
        );
        hasBacklog ||= dueExecutions.hasMore;

        for (const executionDate of dueExecutions.dates) {
          const nextExecution = calculateNextExecution(rt, executionDate);
          const { data: materialization, error: materializationError } = await supabase
            .rpc('materialize_recurring_task', {
              p_recurring_task_id: rt.id,
              p_execution_date: executionDate,
              p_next_execution: nextExecution,
              p_schedule_snapshot: scheduleSnapshot,
            })
            .single();

          if (materializationError || !materialization) {
            const message = materializationError?.message
              || `La materialización de ${rt.name} no devolvió resultado`;
            failures.push({ recurringTaskId: rt.id, executionDate, error: message });
            hasBacklog = true;
            console.error(`❌ Error materializing recurring task ${rt.name}:`, message);

            const { error: executionLogError } = await supabase
              .from('recurring_task_executions')
              .insert({
                recurring_task_id: rt.id,
                execution_date: executionDate,
                success: false,
                error_message: message,
              });
            if (executionLogError) {
              console.error(`⚠️ Could not log recurring task failure ${rt.name}:`, executionLogError);
            }
            break;
          }

          updatedTasks.add(rt.id);
          if (materialization.was_created) {
            generatedTasks.push({
              id: materialization.generated_task_id,
              name: propertyName,
              executionDate,
            });
            console.log(`✅ Task ${rt.name} materialized atomically for ${executionDate}`);
          } else {
            console.log(`↩️ Task ${rt.name} for ${executionDate} already existed; state repaired`);
          }

          if (materialization.was_created && rt.cleaner_id) {
            try {
              const { data: cleanerData } = await supabase
                .from('cleaners')
                .select('name, email')
                .eq('id', rt.cleaner_id)
                .single();

              if (cleanerData?.email) {
                const emailRes = await fetch(
                  `${supabaseUrl}/functions/v1/send-recurring-task-email`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${supabaseServiceKey}`,
                    },
                    body: JSON.stringify({
                      cleanerEmail: cleanerData.email,
                      cleanerName: cleanerData.name || 'Trabajador',
                      taskData: {
                        property: propertyName,
                        address: propertyAddress,
                        date: executionDate,
                        startTime: rt.start_time,
                        endTime: rt.end_time,
                        type: rt.type,
                        recurringTaskName: rt.name,
                      },
                    }),
                  },
                );

                if (!emailRes.ok) {
                  const errText = await emailRes.text();
                  console.error(`⚠️ Email send failed for ${cleanerData.email}:`, errText);
                }
              }
            } catch (emailError: any) {
              console.error(`⚠️ Error sending email for task ${rt.name}:`, emailError.message);
            }
          }

          if (nextExecution === null) {
            console.log(`🔚 Task ${rt.name} deactivated - reached end date`);
          }
        }
      } catch (taskError: any) {
        failures.push({
          recurringTaskId: rt.id,
          executionDate: rt.next_execution,
          error: taskError.message || String(taskError),
        });
        hasBacklog = true;
        console.error(`❌ Error processing task ${rt.name}:`, taskError);
      }
    }

    console.log(
      `✨ Processing complete. Generated ${generatedTasks.length} tasks, `
      + `updated ${updatedTasks.size} recurring tasks, failures ${failures.length}`,
    );

    return new Response(JSON.stringify({
      message: failures.length > 0
        ? "Recurring tasks processed with errors"
        : "Recurring tasks processed successfully",
      processed: generatedTasks.length,
      generatedTasks,
      updatedRecurringTasks: updatedTasks.size,
      failed: failures.length,
      errors: failures,
      hasBacklog,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    const authResponse = authorizationErrorResponse(error, corsHeaders);
    if (authResponse) return authResponse;
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

serve(handler);
