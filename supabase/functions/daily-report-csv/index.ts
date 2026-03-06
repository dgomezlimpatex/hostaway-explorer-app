import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper: format name to uppercase
const formatName = (name: string | null | undefined): string => {
  if (!name || name === 'N/A' || name === 'Sin asignar' || name === 'Sin supervisor') return name || '';
  return name.toUpperCase();
};

// Helper: format service type
const formatServiceType = (type: string): string => {
  if (type === 'limpieza-turistica') return 'Limpieza Turística';
  return type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

// Helper: format status
const formatStatus = (status: string): string => {
  if (status === 'completed') return 'Completada';
  if (status === 'in-progress') return 'En Progreso';
  return 'Pendiente';
};

// Helper: format payment method
const formatPaymentMethod = (method: string | null): string => {
  const map: Record<string, string> = {
    'transferencia': 'Transferencia',
    'efectivo': 'Efectivo',
    'bizum': 'Bizum',
  };
  return map[method || ''] || method || 'No especificado';
};

// Helper: format date DD/MM/YYYY
const formatDate = (d: string): string => {
  if (!d) return '';
  const parts = d.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
};

// Escape CSV cell
const escapeCSV = (val: string | number): string => {
  const s = String(val ?? '');
  return `"${s.replace(/"/g, '""')}"`;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    const dateParam = url.searchParams.get('date'); // YYYY-MM-DD, defaults to today

    if (!token) {
      return new Response('Token requerido', { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Validate token
    const { data: tokenData, error: tokenError } = await supabase
      .from('report_export_tokens')
      .select('id, sede_id, is_active')
      .eq('token', token)
      .single();

    if (tokenError || !tokenData || !tokenData.is_active) {
      return new Response('Token inválido o desactivado', { status: 403, headers: corsHeaders });
    }

    // Update last_used_at
    await supabase
      .from('report_export_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', tokenData.id);

    // Determine date
    const today = dateParam || new Date().toISOString().split('T')[0];

    // Query tasks for the date (exclude trabajo-extraordinario)
    let query = supabase
      .from('tasks')
      .select(`
        id, property, address, date, start_time, end_time, type, status,
        cleaner, coste, duracion, metodo_pago, supervisor,
        propiedad_id, cliente_id, sede_id,
        extraordinary_client_name, extraordinary_billing_address
      `)
      .eq('date', today)
      .neq('type', 'trabajo-extraordinario');

    // Filter by sede if token is scoped
    if (tokenData.sede_id) {
      query = query.eq('sede_id', tokenData.sede_id);
    }

    const { data: tasks, error: tasksError } = await query;

    if (tasksError) {
      throw new Error(`Error fetching tasks: ${tasksError.message}`);
    }

    if (!tasks || tasks.length === 0) {
      // Log empty export
      await supabase.from('daily_report_export_logs').insert({
        export_date: today,
        rows_exported: 0,
        status: 'success',
        token_id: tokenData.id,
        sede_id: tokenData.sede_id,
      });

      // Return just headers
      const headers = ['Sede', 'Fecha del servicio', 'Supervisor', 'Cliente',
        'Tipo de servicio', 'Estado de la tarea', 'Coste total del servicio',
        'Horas del servicio', 'Equipo de trabajo', 'Método de pago', 'Incidencias',
        'Fecha exportación'];
      return new Response(headers.map(h => escapeCSV(h)).join(',') + '\n', {
        headers: { ...corsHeaders, 'Content-Type': 'text/csv; charset=utf-8' },
      });
    }

    // Fetch task_assignments for all tasks to get all worker names
    const taskIds = tasks.map(t => t.id);
    const { data: allAssignments } = await supabase
      .from('task_assignments')
      .select('task_id, cleaner_name')
      .in('task_id', taskIds);

    // Build a map: taskId -> comma-separated cleaner names
    const assignmentsMap = new Map<string, string>();
    if (allAssignments && allAssignments.length > 0) {
      const grouped: Record<string, string[]> = {};
      for (const a of allAssignments) {
        if (!grouped[a.task_id]) grouped[a.task_id] = [];
        grouped[a.task_id].push(a.cleaner_name);
      }
      for (const [tid, names] of Object.entries(grouped)) {
        assignmentsMap.set(tid, names.join(', '));
      }
    }

    // Collect unique IDs for batch lookups
    const propertyIds = [...new Set(tasks.map(t => t.propiedad_id).filter(Boolean))];
    const clienteIds = [...new Set(tasks.map(t => t.cliente_id).filter(Boolean))];
    const sedeIds = [...new Set(tasks.map(t => t.sede_id).filter(Boolean))];

    // Batch fetch properties, clients, sedes
    const [propertiesRes, clientsRes, sedesRes] = await Promise.all([
      propertyIds.length > 0
        ? supabase.from('properties').select('id, nombre, codigo, direccion, cliente_id, coste_servicio, duracion_servicio, sede_id, exclude_from_export, numero_sabanas, numero_sabanas_pequenas, numero_sabanas_suite, numero_fundas_almohada, numero_toallas_grandes, numero_toallas_pequenas, numero_alfombrines, amenities_bano, amenities_cocina, cantidad_rollos_papel_higienico, cantidad_rollos_papel_cocina, kit_alimentario, champu, acondicionador, gel_ducha, jabon_liquido, ambientador_bano, bolsas_basura, detergente_lavavajillas, bayetas_cocina, estropajos, limpiacristales, desinfectante_bano, aceite, vinagre, sal, azucar').in('id', propertyIds)
        : { data: [], error: null },
      clienteIds.length > 0
        ? supabase.from('clients').select('id, nombre, supervisor, metodo_pago').in('id', clienteIds)
        : { data: [], error: null },
      sedeIds.length > 0
        ? supabase.from('sedes').select('id, nombre').in('id', sedeIds)
        : { data: [], error: null },
    ]);

    const propertiesMap = new Map((propertiesRes.data || []).map(p => [p.id, p]));
    const clientsMap = new Map((clientsRes.data || []).map(c => [c.id, c]));
    const sedesMap = new Map((sedesRes.data || []).map(s => [s.id, s]));

    // Filter out tasks whose property has exclude_from_export = true
    const excludedPropertyIds = new Set(
      (propertiesRes.data || []).filter(p => p.exclude_from_export).map(p => p.id)
    );
    const filteredTasks = tasks.filter(t => !t.propiedad_id || !excludedPropertyIds.has(t.propiedad_id));

    // Also fetch clients for properties that have cliente_id
    const propClienteIds = [...new Set(
      (propertiesRes.data || []).map(p => p.cliente_id).filter(Boolean).filter(id => !clientsMap.has(id))
    )];
    if (propClienteIds.length > 0) {
      const { data: extraClients } = await supabase
        .from('clients').select('id, nombre, supervisor, metodo_pago').in('id', propClienteIds);
      (extraClients || []).forEach(c => clientsMap.set(c.id, c));
    }

    const exportTimestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // Generate CSV rows (no headers - Apps Script will append)
    const rows = filteredTasks.map(task => {
      const isExtraordinary = task.type === 'trabajo-extraordinario';
      const property = task.propiedad_id ? propertiesMap.get(task.propiedad_id) : null;
      const sede = task.sede_id ? sedesMap.get(task.sede_id) : null;

      // Client resolution
      let clientName: string, clientSupervisor: string, clientPaymentMethod: string;

      if (isExtraordinary && task.extraordinary_client_name) {
        clientName = task.extraordinary_client_name;
        clientSupervisor = 'Servicio Extraordinario';
        clientPaymentMethod = task.metodo_pago || 'No especificado';
      } else {
        const client = property?.cliente_id ? clientsMap.get(property.cliente_id) :
          task.cliente_id ? clientsMap.get(task.cliente_id) : null;
        clientName = client?.nombre || 'Cliente desconocido';
        clientSupervisor = client?.supervisor || task.supervisor || 'Sin supervisor';
        clientPaymentMethod = client?.metodo_pago || task.metodo_pago || 'No especificado';
      }

      // Cost and duration
      const taskCost = isExtraordinary ? (task.coste || 0) : (property?.coste_servicio || task.coste || 0);
      const taskDuration = isExtraordinary ? (task.duracion || 120) : (property?.duracion_servicio || task.duracion || 120);

      // Use task_assignments if available, fallback to tasks.cleaner
      const resolvedCleanerStr = assignmentsMap.get(task.id) || task.cleaner || '';
      const cleanerNames = resolvedCleanerStr.split(',').map((n: string) => n.trim()).filter(Boolean);
      const workerCount = Math.max(cleanerNames.length, 1);
      const hoursPerWorker = taskDuration / 60 / workerCount;

      // Incidents text
      const incidents = property ? `${property.nombre} (${property.codigo})` : (task.property || '');

      return [
        sede?.nombre || 'N/A',
        formatDate(task.date),
        formatName(clientSupervisor),
        clientName,
        formatServiceType(task.type),
        formatStatus(task.status),
        taskCost.toFixed(2).replace('.', ','),
        hoursPerWorker.toFixed(2).replace('.', ','),
        formatName(resolvedCleanerStr) || 'Sin asignar',
        formatPaymentMethod(clientPaymentMethod),
        incidents,
        exportTimestamp,
      ].map(escapeCSV).join(',');
    });

    const csvContent = rows.join('\n') + '\n';

    // Log successful export
    await supabase.from('daily_report_export_logs').insert({
      export_date: today,
      rows_exported: filteredTasks.length,
      status: 'success',
      token_id: tokenData.id,
      sede_id: tokenData.sede_id,
    });

    return new Response(csvContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
      },
    });

  } catch (error) {
    console.error('Error in daily-report-csv:', error);

    // Try to log the error
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      await supabase.from('daily_report_export_logs').insert({
        export_date: new Date().toISOString().split('T')[0],
        rows_exported: 0,
        status: 'error',
        error_message: error.message,
      });
    } catch (_) { /* ignore logging errors */ }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
