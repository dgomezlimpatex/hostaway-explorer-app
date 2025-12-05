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
export const fetchLaundryTasksForDateRange = async (
  dateStart: string,
  dateEnd: string,
  sedeIds?: string[]
): Promise<string[]> => {
  let query = supabase
    .from('tasks')
    .select('id')
    .gte('date', dateStart)
    .lte('date', dateEnd)
    .in('type', ['limpieza', 'check', 'mantenimiento']);

  if (sedeIds && sedeIds.length > 0) {
    query = query.in('sede_id', sedeIds);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }

  return (data || []).map(t => t.id);
};

// Detect changes between snapshot and current tasks
export interface TaskChanges {
  newTasks: string[];
  removedTasks: string[];
  // Modified detection would require storing more data in snapshot
}

export const detectTaskChanges = async (
  snapshotTaskIds: string[],
  dateStart: string,
  dateEnd: string,
  sedeIds?: string[]
): Promise<TaskChanges> => {
  const currentTaskIds = await fetchLaundryTasksForDateRange(dateStart, dateEnd, sedeIds);
  
  const snapshotSet = new Set(snapshotTaskIds);
  const currentSet = new Set(currentTaskIds);

  const newTasks = currentTaskIds.filter(id => !snapshotSet.has(id));
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
