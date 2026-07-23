import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const portalDir = new URL('../src/components/client-portal/', import.meta.url);
const portalFiles = readdirSync(portalDir)
  .filter((name) => name.endsWith('.ts') || name.endsWith('.tsx'));

const forbiddenUi = /\bendTime\b|\bend_time\b|hora\s+(?:de\s+)?(?:fin|final|finalizaci[oó]n)|hora\s+real\s+de\s+fin/i;

for (const name of portalFiles) {
  const source = readFileSync(new URL(name, portalDir), 'utf8');
  assert.doesNotMatch(
    source,
    forbiddenUi,
    `${name} must never expose a planned or real completion time in the client portal`,
  );
}

const bookingType = readFileSync(new URL('../src/types/clientPortal.ts', import.meta.url), 'utf8');
assert.doesNotMatch(
  bookingType,
  /\bendTime\b|\bend_time\b/,
  'PortalBooking must not carry a completion time to public UI components',
);

const detailModal = readFileSync(
  new URL('../src/components/client-portal/ReservationDetailModal.tsx', import.meta.url),
  'utf8',
);
assert.doesNotMatch(
  detailModal,
  /\bguestCount\b|Huéspedes|<Users\b/,
  'Public cleaning detail must not display guest information',
);

const portalHook = readFileSync(new URL('../src/hooks/useClientPortal.ts', import.meta.url), 'utf8');
const publicReadStart = portalHook.indexOf('export const useClientPortalBookings');
const publicReadEnd = portalHook.indexOf('// ============= ADMIN: reservation creation toggle');
assert.ok(publicReadStart >= 0 && publicReadEnd > publicReadStart, 'client portal public read section must be identifiable');
const publicReadSection = portalHook.slice(publicReadStart, publicReadEnd);

const compact = (value) => value.replace(/\s+/g, ' ').trim();
const expectedTaskFields = compact(`
  id, date, start_time, status,
  property, address, propiedad_id,
  properties:propiedad_id (
    id, nombre, codigo, direccion, check_out_predeterminado
  )
`);

assert.ok(
  compact(publicReadSection).includes(`.from('tasks') .select(\` ${expectedTaskFields} \`)`),
  'Public tasks payload must use the exact allowlist and include only the planned start time',
);
assert.match(
  publicReadSection,
  /\.from\('task_reports'\)\s*\.select\('id'\)/,
  'Public report payload must contain exactly the report id',
);
assert.match(
  publicReadSection,
  /\.from\('task_media'\)\s*\.select\('id, file_url, media_type, description'\)/,
  'Public media payload must contain exactly the display fields',
);
assert.match(
  publicReadSection,
  /return \{\s*status: 'ready' as const,\s*media: media \?\? \[\],\s*\};/,
  'Ready report result must expose only status and media',
);
const reportReadStart = publicReadSection.indexOf('export const useClientPortalTaskReport');
const reportReadEnd = publicReadSection.indexOf('// ============= PORTAL: client settings');
assert.ok(reportReadStart >= 0 && reportReadEnd > reportReadStart, 'public report read section must be identifiable');
const reportReadSection = publicReadSection.slice(reportReadStart, reportReadEnd);
assert.doesNotMatch(
  reportReadSection,
  /\bend_time\b|\bendTime\b|\bcreated_at\b|\.select\([^)]*\b(?:timestamp|updated_at)\b|\breport,\s*\}/,
  'Public report and media payloads must not download or return completion-related temporal metadata',
);
assert.match(
  publicReadSection,
  /\.order\('timestamp', \{ ascending: true \}\)/,
  'Photos may remain chronologically ordered without returning their timestamps',
);

console.log('client-portal-no-completion-time: OK');
