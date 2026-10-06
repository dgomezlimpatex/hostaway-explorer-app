import { useCallback, useEffect, useState } from 'react';
import { acceptedSavedTaskChanges } from '@/utils/cleaning-planning/proposalContext';

/** Retain every successful own save until its refreshed data arrives. */
export function usePlanningSavedTaskContext(source: string | undefined, current: string,
  acceptContext: (context: string) => void, paused = false) {
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const recordSavedTask = useCallback((id: string) => {
    setPendingIds(ids => ids.includes(id) ? ids : [...ids, id]);
  }, []);
  useEffect(() => {
    if (!source) { setPendingIds(ids => ids.length ? [] : ids); return; }
    if (paused || !pendingIds.length) return;
    const accepted = acceptedSavedTaskChanges(source, current, pendingIds);
    if (!accepted.length) return;
    acceptContext(current);
    setPendingIds(ids => ids.filter(id => !accepted.includes(id)));
  }, [source, current, acceptContext, paused, pendingIds]);
  return recordSavedTask;
}
