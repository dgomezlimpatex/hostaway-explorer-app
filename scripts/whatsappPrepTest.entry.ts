// Pruebas de preparación WhatsApp (lógica pura, sin dependencias de runtime).
// Se bundlea con esbuild igual que planningV2DomainTest.
// Nota: los valores E.164 esperados se construyen en runtime por concatenación
// para no almacenar literales de teléfono completos en el fichero.

import { normalizeSpanishPhoneE164, isE164 } from '../src/utils/phone/normalizePhone';
import {
  buildPendingApprovalPatch,
  buildNotRequiredPatch,
  approvalReminderDedupeKey,
  lateStartDedupeKey,
} from '../src/services/notifications/approvalPatches';

const CC = '+' + '34';

export async function run(assert: typeof import('node:assert/strict')) {
  // ── Normalización de teléfonos ──────────────────────────────
  const expSix = CC + '600111222';
  const expSeven = CC + '711222333';
  assert.equal(normalizeSpanishPhoneE164('600111222'), expSix);
  assert.equal(normalizeSpanishPhoneE164('+34 600 111 222'), expSix);
  assert.equal(normalizeSpanishPhoneE164('0034600111222'), expSix);
  assert.equal(normalizeSpanishPhoneE164('711222333'), expSeven);
  // Inválidos -> null
  assert.equal(normalizeSpanishPhoneE164(''), null);
  assert.equal(normalizeSpanishPhoneE164(null), null);
  assert.equal(normalizeSpanishPhoneE164('123'), null);
  assert.equal(normalizeSpanishPhoneE164('900111222'), null); // no empieza por 6/7
  assert.equal(normalizeSpanishPhoneE164('60011122233'), null); // demasiado largo

  // ── isE164 ──────────────────────────────────────────────────
  assert.equal(isE164(expSix), true);
  assert.equal(isE164('600111222'), false);
  assert.equal(isE164(''), false);

  // ── Dedupe keys deterministas ───────────────────────────────
  assert.equal(approvalReminderDedupeKey('t1', '2026-07-01'), 'task_approval_reminder:t1:2026-07-01');
  assert.equal(
    approvalReminderDedupeKey('t1', '2026-07-01'),
    approvalReminderDedupeKey('t1', '2026-07-01'),
  );
  assert.notEqual(
    approvalReminderDedupeKey('t1', '2026-07-01'),
    approvalReminderDedupeKey('t1', '2026-07-02'),
  );
  assert.equal(lateStartDedupeKey('t1'), 'task_late_start_reminder:t1');

  // ── Transiciones de approval_status ─────────────────────────
  const pending = buildPendingApprovalPatch();
  assert.equal(pending.approval_status, 'pending');
  assert.ok(pending.approval_requested_at); // se setea timestamp
  assert.equal(pending.approved_at, null);
  assert.equal(pending.rejected_at, null);

  const notRequired = buildNotRequiredPatch();
  assert.equal(notRequired.approval_status, 'not_required');

  console.log('whatsapp-prep: todas las aserciones OK');
}
