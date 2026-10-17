// URL contract to open one exact entity by its stable id.
// Tasks, properties and clients show their detail inside the listing, so the id
// travels as a query parameter; workers have their own profile route.

export type EntityLinkType = 'task' | 'property' | 'worker' | 'client';

export const ENTITY_LINK_PARAM = {
  task: 'taskId',
  property: 'propertyId',
  client: 'clientId',
} as const;

export const entityDetailPath = (type: EntityLinkType, id: string): string => {
  const encoded = encodeURIComponent(id);
  switch (type) {
    case 'task':
      return `/tasks?${ENTITY_LINK_PARAM.task}=${encoded}`;
    case 'property':
      return `/properties?${ENTITY_LINK_PARAM.property}=${encoded}`;
    case 'client':
      return `/clients?${ENTITY_LINK_PARAM.client}=${encoded}`;
    case 'worker':
      return `/workers/${encoded}`;
  }
};

/** Copy of the params without one key, so the rest of the URL context is kept. */
export const withoutSearchParam = (params: URLSearchParams, name: string): URLSearchParams =>
  new URLSearchParams([...params].filter(([key]) => key !== name));

export type LinkedEntityState<T> =
  | { status: 'none' }
  | { status: 'loading'; id: string }
  | { status: 'found'; id: string; entity: T }
  | { status: 'unavailable'; id: string };

/**
 * Resolve a linked id strictly by identity within the records the user can see
 * in the active sede. Never falls back to a similar or first record.
 */
export function resolveLinkedEntity<T extends { id: string; sedeId?: string | null }>(
  id: string | null,
  records: readonly T[] | undefined | null,
  { ready, sedeId }: { ready: boolean; sedeId?: string | null },
): LinkedEntityState<T> {
  if (!id) return { status: 'none' };
  if (!ready || !records) return { status: 'loading', id };
  const entity = records.find((record) => record.id === id);
  // A record that reports another sede is treated as not available here.
  if (!entity || (sedeId && entity.sedeId && entity.sedeId !== sedeId)) return { status: 'unavailable', id };
  return { status: 'found', id, entity };
}
