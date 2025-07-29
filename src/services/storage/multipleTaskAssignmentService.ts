import { supabase } from '@/integrations/supabase/client';
import { TaskAssignment } from '@/types/taskAssignments';
import { Task } from '@/types/calendar';

export class MultipleTaskAssignmentService {
  async getTaskAssignments(taskId: string): Promise<TaskAssignment[]> {
    const { data, error } = await supabase
      .from('task_assignments')
      .select('*')
      .eq('task_id', taskId);

    if (error) {
      throw new Error(`Error fetching task assignments: ${error.message}`);
    }

    return data || [];
  }

  async assignMultipleCleaners(taskId: string, cleanerIds: string[]): Promise<TaskAssignment[]> {
    // First, get cleaner details including email
    const { data: cleaners, error: cleanersError } = await supabase
      .from('cleaners')
      .select('id, name, email')
      .in('id', cleanerIds);

    if (cleanersError) {
      throw new Error(`Error fetching cleaners: ${cleanersError.message}`);
    }

    // Get task details for email
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (taskError) {
      throw new Error(`Error fetching task: ${taskError.message}`);
    }

    // Clear existing assignments for this task
    await this.clearTaskAssignments(taskId);

    // Create new assignments
    const assignments = cleaners.map(cleaner => ({
      task_id: taskId,
      cleaner_id: cleaner.id,
      cleaner_name: cleaner.name,
      assigned_by: null // Will be set by RLS/triggers if needed
    }));

    const { data, error } = await supabase
      .from('task_assignments')
      .insert(assignments)
      .select();

    if (error) {
      throw new Error(`Error creating assignments: ${error.message}`);
    }

    // Update the main task with primary cleaner info (first one)
    if (cleaners.length > 0) {
      await supabase
        .from('tasks')
        .update({
          cleaner: cleaners[0].name,
          cleaner_id: cleaners[0].id
        })
        .eq('id', taskId);
    }

    // Send assignment emails to all cleaners
    const emailPromises = cleaners.map(async (cleaner) => {
      if (cleaner.email) {
        try {
          console.log('Sending assignment email to:', cleaner.email, 'for task:', taskId);
          
          // Prepare task data for email
          const taskData = {
            property: task.property,
            address: task.address,
            date: task.date,
            startTime: task.start_time,
            endTime: task.end_time,
            type: task.type || 'Limpieza general',
            notes: task.supervisor ? `Supervisor: ${task.supervisor}` : undefined
          };

          // Call the edge function to send the email
          const { data: emailData, error: emailError } = await supabase.functions.invoke('send-task-assignment-email', {
            body: {
              taskId: task.id,
              cleanerEmail: cleaner.email,
              cleanerName: cleaner.name,
              taskData
            }
          });

          if (emailError) {
            console.error('Error sending assignment email to', cleaner.email, ':', emailError);
          } else {
            console.log('Assignment email sent successfully to', cleaner.email, ':', emailData);
          }
        } catch (error) {
          console.error('Failed to send assignment email to', cleaner.email, ':', error);
        }
      } else {
        console.log('Cleaner', cleaner.name, 'has no email address, skipping email notification');
      }
    });

    // Wait for all emails to be sent (but don't fail the assignment if emails fail)
    await Promise.allSettled(emailPromises);

    return data || [];
  }

  async clearTaskAssignments(taskId: string): Promise<void> {
    // Get current assignments for email notifications
    const { data: currentAssignments, error: assignmentsError } = await supabase
      .from('task_assignments')
      .select(`
        cleaner_id,
        cleaner_name,
        cleaners!inner(email, name)
      `)
      .eq('task_id', taskId);

    // Get task details for email
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    // Delete assignments
    const { error } = await supabase
      .from('task_assignments')
      .delete()
      .eq('task_id', taskId);

    if (error) {
      throw new Error(`Error clearing assignments: ${error.message}`);
    }

    // Send unassignment emails to all currently assigned cleaners
    if (currentAssignments && task && !assignmentsError && !taskError) {
      const emailPromises = currentAssignments.map(async (assignment: any) => {
        const cleaner = assignment.cleaners;
        if (cleaner?.email) {
          try {
            console.log('Sending unassignment email to:', cleaner.email, 'for cleared task:', taskId);
            
            // Prepare task data for email
            const taskData = {
              property: task.property,
              address: task.address,
              date: task.date,
              startTime: task.start_time,
              endTime: task.end_time,
              type: task.type || 'Limpieza general',
              notes: task.supervisor ? `Supervisor: ${task.supervisor}` : undefined
            };

            // Call the edge function to send the unassignment email
            const { data: emailData, error: emailError } = await supabase.functions.invoke('send-task-unassignment-email', {
              body: {
                taskId: task.id,
                cleanerEmail: cleaner.email,
                cleanerName: cleaner.name,
                taskData,
                reason: 'unassigned'
              }
            });

            if (emailError) {
              console.error('Error sending unassignment email to', cleaner.email, ':', emailError);
            } else {
              console.log('Unassignment email sent successfully to', cleaner.email, ':', emailData);
            }
          } catch (error) {
            console.error('Failed to send unassignment email to', cleaner.email, ':', error);
          }
        }
      });

      // Wait for all emails to be sent (but don't fail the operation if emails fail)
      await Promise.allSettled(emailPromises);
    }

    // Clear the main task cleaner info too
    await supabase
      .from('tasks')
      .update({
        cleaner: null,
        cleaner_id: null
      })
      .eq('id', taskId);
  }

  async removeCleanerFromTask(taskId: string, cleanerId: string): Promise<void> {
    // Get cleaner and task details for email before removing
    const { data: cleaner, error: cleanerError } = await supabase
      .from('cleaners')
      .select('email, name')
      .eq('id', cleanerId)
      .single();

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    // Remove the assignment
    const { error } = await supabase
      .from('task_assignments')
      .delete()
      .eq('task_id', taskId)
      .eq('cleaner_id', cleanerId);

    if (error) {
      throw new Error(`Error removing cleaner assignment: ${error.message}`);
    }

    // Send unassignment email if cleaner has email
    if (cleaner?.email && task && !cleanerError && !taskError) {
      try {
        console.log('Sending unassignment email to:', cleaner.email, 'for task:', taskId);
        
        // Prepare task data for email
        const taskData = {
          property: task.property,
          address: task.address,
          date: task.date,
          startTime: task.start_time,
          endTime: task.end_time,
          type: task.type || 'Limpieza general',
          notes: task.supervisor ? `Supervisor: ${task.supervisor}` : undefined
        };

        // Call the edge function to send the unassignment email
        const { data: emailData, error: emailError } = await supabase.functions.invoke('send-task-unassignment-email', {
          body: {
            taskId: task.id,
            cleanerEmail: cleaner.email,
            cleanerName: cleaner.name,
            taskData,
            reason: 'unassigned'
          }
        });

        if (emailError) {
          console.error('Error sending unassignment email to', cleaner.email, ':', emailError);
        } else {
          console.log('Unassignment email sent successfully to', cleaner.email, ':', emailData);
        }
      } catch (error) {
        console.error('Failed to send unassignment email to', cleaner.email, ':', error);
      }
    }

    // Update main task if this was the primary cleaner
    const { data: remainingAssignments } = await supabase
      .from('task_assignments')
      .select('cleaner_id, cleaner_name')
      .eq('task_id', taskId)
      .limit(1);

    if (remainingAssignments && remainingAssignments.length > 0) {
      // Update with new primary cleaner
      await supabase
        .from('tasks')
        .update({
          cleaner: remainingAssignments[0].cleaner_name,
          cleaner_id: remainingAssignments[0].cleaner_id
        })
        .eq('id', taskId);
    } else {
      // No cleaners left, clear main task
      await supabase
        .from('tasks')
        .update({
          cleaner: null,
          cleaner_id: null
        })
        .eq('id', taskId);
    }
  }

  async getTasksWithAssignments(): Promise<(Task & { assignments: TaskAssignment[] })[]> {
    // First get all tasks
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*');

    if (tasksError) {
      throw new Error(`Error fetching tasks: ${tasksError.message}`);
    }

    // Then get all assignments
    const { data: assignments, error: assignmentsError } = await supabase
      .from('task_assignments')
      .select('*');

    if (assignmentsError) {
      throw new Error(`Error fetching assignments: ${assignmentsError.message}`);
    }

    // Map tasks to include assignments
    return (tasks || []).map(task => ({
      id: task.id,
      created_at: task.created_at,
      updated_at: task.updated_at,
      property: task.property,
      address: task.address,
      startTime: task.start_time,
      endTime: task.end_time,
      type: task.type,
      status: task.status as 'pending' | 'in-progress' | 'completed',
      checkOut: task.check_out,
      checkIn: task.check_in,
      cleaner: task.cleaner,
      backgroundColor: task.background_color,
      date: task.date,
      clienteId: task.cliente_id,
      propertyId: task.propiedad_id,
      duration: task.duracion,
      cost: task.coste,
      paymentMethod: task.metodo_pago,
      supervisor: task.supervisor,
      cleanerId: task.cleaner_id,
      assignments: (assignments || []).filter(a => a.task_id === task.id)
    }));
  }
}

export const multipleTaskAssignmentService = new MultipleTaskAssignmentService();