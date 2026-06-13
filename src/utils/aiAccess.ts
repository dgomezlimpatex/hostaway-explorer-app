import type { User } from '@supabase/supabase-js';

export const AI_ALLOWED_EMAIL = 'dgomezlimpatex@gmail.com';

export function normalizeEmail(email?: string | null) {
  return (email || '').trim().toLowerCase();
}

export function isAiAllowedEmail(email?: string | null) {
  return normalizeEmail(email) === AI_ALLOWED_EMAIL;
}

export function isAiAllowedUser(user?: User | null, profile?: { email?: string | null } | null) {
  return isAiAllowedEmail(user?.email) || isAiAllowedEmail(profile?.email);
}
