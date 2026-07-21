import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const service = readFileSync(join(process.cwd(), 'src/services/planning/operationalPlanningService.ts'), 'utf8');
const sender = readFileSync(join(process.cwd(), 'supabase/functions/send-planning-batch-email/index.ts'), 'utf8');

assert.match(sender, /const \{ data: emailData, error: emailError \} = await resend\.emails\.send/);
assert.match(sender, /if \(emailError\) throw/);
assert.match(sender, /success:\s*true,\s*id:\s*emailData\?\.id/);

const invokeBlock = service.slice(
  service.indexOf("const { data: sendData, error: sendError } = await supabase.functions.invoke('send-planning-batch-email'"),
  service.indexOf(".update({ status: 'failed'", service.indexOf("const { data: sendData, error: sendError } = await supabase.functions.invoke('send-planning-batch-email'")),
);
assert.match(invokeBlock, /const \{ data: sendData, error: sendError \} = await supabase\.functions\.invoke/);
assert.match(invokeBlock, /if \(sendError \|\| sendData\?\.success !== true\)/);
assert.match(invokeBlock, /const \{ error: sentUpdateError \}/);
assert.match(invokeBlock, /if \(sentUpdateError\) throw sentUpdateError/);

console.log('planning-email-delivery-semantics-tests: OK');
