export const ROUTE_V2_OWNER_EMAIL = 'dgomezlimpatex@gmail.com';

export function isRouteV2Owner(email?: string | null) {
  return (email || '').trim().toLowerCase() === ROUTE_V2_OWNER_EMAIL;
}
