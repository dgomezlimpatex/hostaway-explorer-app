import { useEffect, useMemo, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useSede } from '@/contexts/SedeContext';
import { getSupervisionTasks, fetchSupervisionWorkspace, createRoute, addStop, reorderStop, createReservationSnapshot, saveReview, createIncident, updateIncidentStatus, completeRoute, flushSupervisionQueue, uploadSupervisionPhoto } from './supervisionStorage';
import type { Task } from '@/types/calendar';
import type { SupervisionIncident, SupervisionReview, SupervisionRoute, SupervisionStop } from './types';
import { setSupervisionQueueOwner } from './offlineQueue';

const EMPTY_INCIDENTS: SupervisionIncident[] = [];
const EMPTY_STOPS: SupervisionStop[] = [];
const EMPTY_TASKS: Task[] = [];

export const useSupervisionWorkspace = (date: string) => {
  const { activeSede } = useSede();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const sedeId = activeSede?.id || '';
  const userId = user?.id || '';
  const enabled = Boolean(sedeId && date && userId);
  const queryKey = useMemo(() => ['supervision-workspace', userId, sedeId, date], [userId, sedeId, date]);

  const workspaceQuery = useQuery({
    queryKey,
    queryFn: () => {
      setSupervisionQueueOwner(userId);
      return fetchSupervisionWorkspace(sedeId, date);
    },
    enabled,
    staleTime: 10_000,
  });

  const tasksQuery = useQuery({
    queryKey: ['supervision-tasks', userId, sedeId, date],
    queryFn: () => getSupervisionTasks(sedeId, date),
    enabled,
    staleTime: 60_000,
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);
  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey });
    void queryClient.invalidateQueries({ queryKey: ['supervision-tasks', userId, sedeId, date] });
  }, [queryClient, queryKey, userId, sedeId, date]);

  const createRouteMutation = useMutation({
    mutationFn: (input: { name: string }) => createRoute(sedeId, date, input.name, user?.id),
    onSuccess: invalidate,
  });

  const addStopMutation = useMutation({
    mutationFn: (input: Omit<SupervisionStop, 'id' | 'created_at' | 'updated_at'>) => addStop(sedeId, date, input),
    onSuccess: invalidate,
  });

  const reorderStopMutation = useMutation({
    mutationFn: (input: { stop: SupervisionStop; direction: 'up' | 'down'; knownStops?: SupervisionStop[] }) => reorderStop(sedeId, date, input.stop, input.direction, input.knownStops),
    onSuccess: invalidate,
  });

  const reservationMutation = useMutation({
    mutationFn: (input: Omit<import('./types').SupervisionReservationSnapshot, 'id' | 'captured_at'>) => createReservationSnapshot(sedeId, date, input),
    onSuccess: invalidate,
  });

  const photoMutation = useMutation({
    mutationFn: (input: { reviewId: string; file: File }) => uploadSupervisionPhoto(sedeId, input.reviewId, input.file),
    onSuccess: invalidate,
  });

  const saveReviewMutation = useMutation({
    mutationFn: (input: Omit<SupervisionReview, 'id' | 'created_at' | 'updated_at'>) => saveReview(sedeId, date, input),
    onSuccess: invalidate,
  });

  const createIncidentMutation = useMutation({
    mutationFn: (input: Omit<SupervisionIncident, 'id' | 'created_at' | 'updated_at'>) => createIncident(sedeId, date, input),
    onSuccess: invalidate,
  });

  const updateIncidentMutation = useMutation({
    mutationFn: (input: { incident: SupervisionIncident; status: SupervisionIncident['status'] }) => updateIncidentStatus(sedeId, date, input.incident, input.status),
    onSuccess: invalidate,
  });

  const completeRouteMutation = useMutation({
    mutationFn: (route: SupervisionRoute) => completeRoute(sedeId, date, route),
    onSuccess: invalidate,
  });

  useEffect(() => {
    setSupervisionQueueOwner(user?.id || null);
  }, [user?.id]);

  useEffect(() => {
    const sync = () => { void flushSupervisionQueue().then((result) => { if (result.synced > 0) invalidate(); }); };
    window.addEventListener('online', sync);
    sync();
    return () => window.removeEventListener('online', sync);
  }, [sedeId, date, invalidate]);

  const routes = workspaceQuery.data?.routes || [];
  const stops = workspaceQuery.data?.stops ?? EMPTY_STOPS;
  const reviews = workspaceQuery.data?.reviews || [];
  const reservations = workspaceQuery.data?.reservations || [];
  const incidents = workspaceQuery.data?.incidents ?? EMPTY_INCIDENTS;
  const tasks = tasksQuery.data ?? EMPTY_TASKS;
  const enrichedStops = useMemo(() => stops.map((stop) => ({ ...stop, task: tasks.find((task) => task.id === stop.task_id) })), [stops, tasks]);
  const pendingIncidents = useMemo(() => incidents.filter((incident) => !['resolved', 'archived'].includes(incident.status)), [incidents]);

  return {
    activeSede,
    user,
    sedeId,
    routes,
    stops: enrichedStops,
    reviews,
    reservations,
    incidents,
    pendingIncidents,
    tasks,
    isLoading: workspaceQuery.isLoading || tasksQuery.isLoading,
    isFetching: workspaceQuery.isFetching || tasksQuery.isFetching,
    error: workspaceQuery.error || tasksQuery.error,
    warning: workspaceQuery.data?.warning,
    storageMode: workspaceQuery.data?.storageMode || 'remote',
    refresh,
    createRoute: createRouteMutation.mutateAsync,
    addStop: addStopMutation.mutateAsync,
    moveStop: reorderStopMutation.mutateAsync,
    saveReservation: reservationMutation.mutateAsync,
    uploadPhoto: photoMutation.mutateAsync,
    saveReview: saveReviewMutation.mutateAsync,
    createIncident: createIncidentMutation.mutateAsync,
    updateIncident: updateIncidentMutation.mutateAsync,
    completeRoute: completeRouteMutation.mutateAsync,
    isSaving: createRouteMutation.isPending || addStopMutation.isPending || reorderStopMutation.isPending || reservationMutation.isPending || photoMutation.isPending || saveReviewMutation.isPending || createIncidentMutation.isPending || updateIncidentMutation.isPending || completeRouteMutation.isPending,
  };
};
