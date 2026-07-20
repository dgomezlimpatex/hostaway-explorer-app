import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  OPERATIONAL_TEMPLATES,
  validateOperationalTemplates,
} from './whatsappOperationalTemplates.mjs';

assert.deepEqual(validateOperationalTemplates(), []);
assert.equal(OPERATIONAL_TEMPLATES.length, 6);
assert.equal(new Set(OPERATIONAL_TEMPLATES.map((template) => template.name)).size, 6);
assert.ok(OPERATIONAL_TEMPLATES.every((template) => template.category === 'UTILITY'));
assert.ok(OPERATIONAL_TEMPLATES.every((template) => template.language === 'es'));

const expectedVariables = new Map([
  ['task_assigned_approval_es', 6],
  ['task_modified_es', 5],
  ['task_cancelled_es', 5],
  ['task_approval_reminder_es', 5],
  ['task_late_start_reminder_es', 3],
  ['task_rejected_admin_alert_es', 4],
]);

for (const template of OPERATIONAL_TEMPLATES) {
  const body = template.components.find((component) => component.type === 'BODY');
  const variables = [...body.text.matchAll(/\{\{(\d+)\}\}/g)];
  assert.equal(variables.length, expectedVariables.get(template.name), template.name);
  assert.equal(body.example.body_text[0].length, variables.length, template.name);
}

const assigned = OPERATIONAL_TEMPLATES.find((template) => template.name === 'task_assigned_approval_es');
const assignedButtons = assigned.components.find((component) => component.type === 'BUTTONS');
assert.deepEqual(assignedButtons.buttons.map((button) => button.text), ['Confirmar', 'No disponible']);

const late = OPERATIONAL_TEMPLATES.find((template) => template.name === 'task_late_start_reminder_es');
const lateButtons = late.components.find((component) => component.type === 'BUTTONS');
assert.equal(lateButtons, undefined);

const sendFunction = await readFile(new URL('../supabase/functions/send-whatsapp-notification/index.ts', import.meta.url), 'utf8');
assert.match(
  sendFunction,
  /case 'task_approval_reminder_es':\s*bodyParameters = \[name, property, date, start, end\];/,
  'El recordatorio debe incluir fecha para evitar confirmaciones ambiguas',
);

console.log('whatsapp-operational-templates-tests: OK');
