import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSede } from '@/contexts/SedeContext';

export interface SearchResult {
  id: string;
  type: 'task' | 'property' | 'worker' | 'client';
  title: string;
  subtitle: string;
  meta?: string;
}

export interface GroupedSearchResults {
  tasks: SearchResult[];
  properties: SearchResult[];
  workers: SearchResult[];
  clients: SearchResult[];
}

const EMPTY_RESULTS: GroupedSearchResults = {
  tasks: [],
  properties: [],
  workers: [],
  clients: [],
};

export const useGlobalSearch = (searchTerm: string) => {
  const [results, setResults] = useState<GroupedSearchResults>(EMPTY_RESULTS);
  const [isSearching, setIsSearching] = useState(false);
  const { activeSede } = useSede();

  const debouncedTerm = useDebounce(searchTerm.trim(), 300);

  useEffect(() => {
    if (!debouncedTerm || debouncedTerm.length < 2) {
      setResults(EMPTY_RESULTS);
      setIsSearching(false);
      return;
    }

    const abortController = new AbortController();

    const performSearch = async () => {
      setIsSearching(true);
      try {
        const term = `%${debouncedTerm}%`;
        const sedeId = activeSede?.id;

        // Build queries in parallel
        let tasksQuery = supabase
          .from('tasks')
          .select('id, property, address, cleaner, status, date, type')
          .or(`property.ilike.${term},address.ilike.${term},cleaner.ilike.${term}`)
          .order('date', { ascending: false })
          .limit(10);

        let propertiesQuery = supabase
          .from('properties')
          .select('id, codigo, nombre, direccion')
          .or(`codigo.ilike.${term},nombre.ilike.${term},direccion.ilike.${term}`)
          .limit(5);

        let cleanersQuery = supabase
          .from('cleaners')
          .select('id, name, email, telefono, is_active')
          .or(`name.ilike.${term},email.ilike.${term},telefono.ilike.${term}`)
          .limit(5);

        let clientsQuery = supabase
          .from('clients')
          .select('id, nombre, email, telefono, cif_nif, tipo_servicio')
          .or(`nombre.ilike.${term},email.ilike.${term},telefono.ilike.${term},cif_nif.ilike.${term}`)
          .limit(5);

        // Apply sede filter
        if (sedeId) {
          tasksQuery = tasksQuery.eq('sede_id', sedeId);
          propertiesQuery = propertiesQuery.eq('sede_id', sedeId);
          cleanersQuery = cleanersQuery.eq('sede_id', sedeId);
          clientsQuery = clientsQuery.eq('sede_id', sedeId);
        }

        const [tasksRes, propertiesRes, cleanersRes, clientsRes] = await Promise.all([
          tasksQuery,
          propertiesQuery,
          cleanersQuery,
          clientsQuery,
        ]);

        if (abortController.signal.aborted) return;

        // If we found workers but few/no tasks, also search tasks by those worker names
        const matchedWorkerNames = (cleanersRes.data || []).map(c => c.name);
        let workerTasks: typeof tasksRes.data = [];
        
        if (matchedWorkerNames.length > 0) {
          const existingTaskIds = new Set((tasksRes.data || []).map(t => t.id));
          
          // Fetch tasks assigned to matching workers
          let workerTasksQuery = supabase
            .from('tasks')
            .select('id, property, address, cleaner, status, date, type')
            .in('cleaner', matchedWorkerNames)
            .order('date', { ascending: false })
            .limit(10);
          
          if (sedeId) {
            workerTasksQuery = workerTasksQuery.eq('sede_id', sedeId);
          }
          
          const workerTasksRes = await workerTasksQuery;
          if (!abortController.signal.aborted) {
            workerTasks = (workerTasksRes.data || []).filter(t => !existingTaskIds.has(t.id));
          }
        }

        if (abortController.signal.aborted) return;

        // Combine direct task matches + worker-related tasks
        const allTasks = [...(tasksRes.data || []), ...workerTasks];
        // Sort by date desc and limit
        allTasks.sort((a, b) => b.date.localeCompare(a.date));
        const limitedTasks = allTasks.slice(0, 15);

        const tasks: SearchResult[] = limitedTasks.map((t) => ({
          id: t.id,
          type: 'task' as const,
          title: t.property || 'Sin propiedad',
          subtitle: `${t.date} · ${t.cleaner || 'Sin asignar'}`,
          meta: t.status,
        }));

        const properties: SearchResult[] = (propertiesRes.data || []).map((p) => ({
          id: p.id,
          type: 'property' as const,
          title: p.codigo || p.nombre,
          subtitle: p.direccion,
        }));

        const workers: SearchResult[] = (cleanersRes.data || []).map((c) => ({
          id: c.id,
          type: 'worker' as const,
          title: c.name,
          subtitle: c.email || c.telefono || '',
          meta: c.is_active ? 'Activo' : 'Inactivo',
        }));

        const clients: SearchResult[] = (clientsRes.data || []).map((cl) => ({
          id: cl.id,
          type: 'client' as const,
          title: cl.nombre,
          subtitle: cl.tipo_servicio || cl.email || '',
          meta: cl.cif_nif || undefined,
        }));

        setResults({ tasks, properties, workers, clients });
      } catch (error) {
        console.error('Global search error:', error);
      } finally {
        if (!abortController.signal.aborted) {
          setIsSearching(false);
        }
      }
    };

    performSearch();

    return () => {
      abortController.abort();
    };
  }, [debouncedTerm, activeSede?.id]);

  const hasResults = useMemo(() => {
    return (
      results.tasks.length > 0 ||
      results.properties.length > 0 ||
      results.workers.length > 0 ||
      results.clients.length > 0
    );
  }, [results]);

  const totalResults = useMemo(() => {
    return (
      results.tasks.length +
      results.properties.length +
      results.workers.length +
      results.clients.length
    );
  }, [results]);

  return { results, isSearching, hasResults, totalResults };
};

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}
