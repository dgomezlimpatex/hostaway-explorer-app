import { supabase } from '@/integrations/supabase/client';

// Get the base URL for share links
export const getShareLinkUrl = (token: string): string => {
  // Use current origin for the URL
  const baseUrl = window.location.origin;
  return `${baseUrl}/lavanderia/${token}`;
};

// Copy share link to clipboard
export const copyShareLinkToClipboard = async (token: string): Promise<boolean> => {
  const url = getShareLinkUrl(token);
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = url;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      return true;
    } catch (e) {
      console.error('Fallback copy failed:', e);
      return false;
    } finally {
      document.body.removeChild(textArea);
    }
  }
};

// Calculate expiration date based on option
export const calculateExpirationDate = (option: 'day' | 'week' | 'month' | 'permanent'): string | null => {
  if (option === 'permanent') return null;
  
  const now = new Date();
  switch (option) {
    case 'day':
      now.setDate(now.getDate() + 1);
      break;
    case 'week':
      now.setDate(now.getDate() + 7);
      break;
    case 'month':
      now.setMonth(now.getMonth() + 1);
      break;
  }
  return now.toISOString();
};

// Fetch tasks for laundry (to be included in snapshot)
// Only includes tasks of type 'mantenimiento-airbnb' AND properties with linen control enabled
export const fetchLaundryTasksForDateRange = async (
  dateStart: string,
  dateEnd: string,
  sedeIds?: string[]
): Promise<string[]> => {
  // First fetch tasks with property info
  let query = supabase
    .from('tasks')
    .select(`
      id,
      propiedad_id,
      properties:propiedad_id (
        id,
        linen_control_enabled,
        cliente_id,
        clients:cliente_id (
          id,
          linen_control_enabled
        )
      )
    `)
    .gte('date', dateStart)
    .lte('date', dateEnd)
    .eq('type', 'mantenimiento-airbnb');

  if (sedeIds && sedeIds.length > 0) {
    query = query.in('sede_id', sedeIds);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }

  // Filter tasks based on linen control settings
  // Property setting takes precedence, otherwise inherit from client
  const filteredTasks = (data || []).filter(task => {
    const property = task.properties as any;
    if (!property) return false;
    
    const propertyLinenEnabled = property.linen_control_enabled;
    const clientLinenEnabled = property.clients?.linen_control_enabled ?? false;
    
    // If property has explicit setting, use it; otherwise inherit from client
    const effectiveValue = propertyLinenEnabled !== null ? propertyLinenEnabled : clientLinenEnabled;
    
    return effectiveValue === true;
  });

  return filteredTasks.map(t => t.id);
};

// Detect changes between original tasks (at creation time) and current tasks
export interface TaskChanges {
  newTasks: string[];
  removedTasks: string[];
}

export const detectTaskChanges = async (
  originalTaskIds: string[], // All tasks that existed when link was created
  snapshotTaskIds: string[], // Tasks currently included in the snapshot
  dateStart: string,
  dateEnd: string,
  sedeIds?: string[]
): Promise<TaskChanges> => {
  const currentTaskIds = await fetchLaundryTasksForDateRange(dateStart, dateEnd, sedeIds);
  
  const originalSet = new Set(originalTaskIds);
  const snapshotSet = new Set(snapshotTaskIds);
  const currentSet = new Set(currentTaskIds);

  // New tasks = tasks that exist now but didn't exist at link creation
  const newTasks = currentTaskIds.filter(id => !originalSet.has(id));
  
  // Removed tasks = tasks in snapshot that no longer exist
  const removedTasks = snapshotTaskIds.filter(id => !currentSet.has(id));

  return {
    newTasks,
    removedTasks,
  };
};

// Format date range for display
export const formatDateRange = (dateStart: string, dateEnd: string): string => {
  const start = new Date(dateStart);
  const end = new Date(dateEnd);
  
  const formatOptions: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
  };
  
  if (dateStart === dateEnd) {
    return start.toLocaleDateString('es-ES', { ...formatOptions, year: 'numeric' });
  }
  
  return `${start.toLocaleDateString('es-ES', formatOptions)} - ${end.toLocaleDateString('es-ES', { ...formatOptions, year: 'numeric' })}`;
};

// Check if a share link is expired
export const isShareLinkExpired = (expiresAt: string | null): boolean => {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
};

// Format expiration status
export const formatExpirationStatus = (expiresAt: string | null, isPermanent: boolean): string => {
  if (isPermanent) return 'Permanente';
  if (!expiresAt) return 'Sin expiración';
  
  const expDate = new Date(expiresAt);
  if (expDate < new Date()) {
    return 'Expirado';
  }
  
  return `Expira: ${expDate.toLocaleDateString('es-ES', { 
    day: 'numeric', 
    month: 'short', 
    hour: '2-digit', 
    minute: '2-digit' 
  })}`;
};
