import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RecurringTask {
  id: string;
  name: string;
  description?: string;
  clienteId?: string;
  propiedadId?: string;
  type: string;
  startTime: string;
  endTime: string;
  checkOut: string;
  checkIn: string;
  duracion?: number;
  coste?: number;
  metodoPago?: string;
  supervisor?: string;
  cleaner?: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  nextExecution: string;
  lastExecution?: string;
  createdAt: string;
  sede_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log("🔄 Starting recurring tasks processing...");
    
    // Get all active recurring tasks that are due for execution
    const now = new Date().toISOString();
    const { data: recurringTasks, error: fetchError } = await supabase
      .from('recurring_tasks')
      .select('*')
      .eq('isActive', true)
      .lte('nextExecution', now);

    if (fetchError) {
      console.error("❌ Error fetching recurring tasks:", fetchError);
      throw fetchError;
    }

    console.log(`📋 Found ${recurringTasks?.length || 0} tasks to process`);

    if (!recurringTasks || recurringTasks.length === 0) {
      return new Response(JSON.stringify({ 
        message: "No recurring tasks to process",
        processed: 0 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const generatedTasks: any[] = [];
    const updatedTasks: string[] = [];

    for (const recurringTask of recurringTasks as RecurringTask[]) {
      try {
        console.log(`🔨 Processing task: ${recurringTask.name}`);

        // Create the new task
        const { data: newTask, error: createError } = await supabase
          .from('tasks')
          .insert({
            name: recurringTask.name,
            description: recurringTask.description,
            clienteId: recurringTask.clienteId,
            propiedadId: recurringTask.propiedadId,
            type: recurringTask.type,
            startTime: recurringTask.startTime,
            endTime: recurringTask.endTime,
            checkOut: recurringTask.checkOut,
            checkIn: recurringTask.checkIn,
            duracion: recurringTask.duracion,
            coste: recurringTask.coste,
            metodoPago: recurringTask.metodoPago,
            supervisor: recurringTask.supervisor,
            cleaner: recurringTask.cleaner,
            sede_id: recurringTask.sede_id,
            status: 'pending'
          })
          .select()
          .single();

        if (createError) {
          console.error(`❌ Error creating task for ${recurringTask.name}:`, createError);
          continue;
        }

        generatedTasks.push(newTask);

        // Calculate next execution date
        const nextExecution = calculateNextExecution(recurringTask);
        
        // Check if task should be deactivated (past end date)
        const shouldDeactivate = recurringTask.endDate && 
          new Date(nextExecution) > new Date(recurringTask.endDate);

        // Update the recurring task
        const { error: updateError } = await supabase
          .from('recurring_tasks')
          .update({
            lastExecution: now,
            nextExecution: shouldDeactivate ? null : nextExecution,
            isActive: !shouldDeactivate
          })
          .eq('id', recurringTask.id);

        if (updateError) {
          console.error(`❌ Error updating recurring task ${recurringTask.name}:`, updateError);
        } else {
          updatedTasks.push(recurringTask.id);
          console.log(`✅ Task ${recurringTask.name} processed successfully`);
          
          if (shouldDeactivate) {
            console.log(`🔚 Task ${recurringTask.name} deactivated - reached end date`);
          }
        }

      } catch (taskError) {
        console.error(`❌ Error processing task ${recurringTask.name}:`, taskError);
      }
    }

    console.log(`✨ Processing complete. Generated ${generatedTasks.length} tasks, updated ${updatedTasks.length} recurring tasks`);

    return new Response(JSON.stringify({
      message: "Recurring tasks processed successfully",
      processed: generatedTasks.length,
      generatedTasks: generatedTasks.map(t => ({ id: t.id, name: t.name })),
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

function calculateNextExecution(task: RecurringTask): string {
  const lastExecution = new Date(task.lastExecution || task.nextExecution);
  const nextDate = new Date(lastExecution);

  switch (task.frequency) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + task.interval);
      break;
      
    case 'weekly':
      if (task.daysOfWeek && task.daysOfWeek.length > 0) {
        // Find next occurrence of specified days
        let daysAdded = 0;
        const maxDays = 14; // Prevent infinite loop
        
        do {
          daysAdded++;
          nextDate.setDate(nextDate.getDate() + 1);
        } while (
          !task.daysOfWeek.includes(nextDate.getDay()) && 
          daysAdded < maxDays
        );
      } else {
        nextDate.setDate(nextDate.getDate() + (7 * task.interval));
      }
      break;
      
    case 'monthly':
      if (task.dayOfMonth) {
        nextDate.setMonth(nextDate.getMonth() + task.interval);
        
        // Handle end of month cases
        const lastDayOfMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
        const targetDay = Math.min(task.dayOfMonth, lastDayOfMonth);
        nextDate.setDate(targetDay);
      } else {
        nextDate.setMonth(nextDate.getMonth() + task.interval);
      }
      break;
  }

  return nextDate.toISOString();
}

serve(handler);