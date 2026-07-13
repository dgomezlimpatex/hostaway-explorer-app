import { rpcUntyped } from '@/lib/supabaseUntyped';
import {
  loadNextClientEntry as loadNextClientEntryWithReader,
  type NextClientEntry,
  type NextClientEntryInput,
  type NextClientEntryReader,
} from './nextClientEntryDomain';

export {
  canViewNextClientEntry,
  formatNextClientEntryLabel,
} from './nextClientEntryDomain';
export type { NextClientEntry } from './nextClientEntryDomain';

export const readAdminNextClientEntry: NextClientEntryReader = async ({ propertyId, fromDate }) => {
  const { data, error } = await rpcUntyped('get_admin_next_client_entry', {
    _property_id: propertyId,
    _from_date: fromDate,
  });

  if (error) throw error;

  const row = (Array.isArray(data) ? data[0] : data) as {
    check_in_date?: string;
    updated_at?: string | null;
  } | null;

  if (!row?.check_in_date) return null;

  return {
    checkInDate: row.check_in_date,
    updatedAt: row.updated_at ?? null,
  };
};

export const loadNextClientEntry = (
  input: NextClientEntryInput,
): Promise<NextClientEntry | null> => loadNextClientEntryWithReader(input, readAdminNextClientEntry);
