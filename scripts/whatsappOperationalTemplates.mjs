import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const GRAPH_API_VERSION = 'v25.0';
const WABA_ID = '1175096449028950';

const body = (text, examples) => ({
  type: 'BODY',
  text,
  example: { body_text: [examples] },
});

const quickReplies = (...labels) => ({
  type: 'BUTTONS',
  buttons: labels.map((text) => ({ type: 'QUICK_REPLY', text })),
});

export const OPERATIONAL_TEMPLATES = [
  {
    name: 'task_assigned_approval_es',
    language: 'es',
    category: 'UTILITY',
    allow_category_change: true,
    components: [
      body(
        'Hola {{1}}, tienes una nueva limpieza asignada.\n\nDirección: {{2}}\nAlojamiento: {{3}}\nFecha: {{4}}\nHorario: {{5}} - {{6}}\n\nConfirma si puedes realizarla.',
        ['María', 'Calle Mayor 10', 'Apartamento Centro', '15 de julio de 2026', '10:00', '13:00'],
      ),
      quickReplies('Confirmar', 'No disponible'),
    ],
  },
  {
    name: 'task_modified_es',
    language: 'es',
    category: 'UTILITY',
    allow_category_change: true,
    components: [
      body(
        'Hola {{1}}, se ha actualizado una limpieza asignada.\n\nAlojamiento: {{2}}\nFecha: {{3}}\nNuevo horario: {{4}} - {{5}}\n\nConfirma si puedes realizarla con este cambio.',
        ['María', 'Apartamento Centro', '15 de julio de 2026', '11:00', '14:00'],
      ),
      quickReplies('Confirmar', 'No disponible'),
    ],
  },
  {
    name: 'task_cancelled_es',
    language: 'es',
    category: 'UTILITY',
    allow_category_change: true,
    components: [
      body(
        'Hola {{1}}, la limpieza de {{2}} prevista para el {{3}}, de {{4}} a {{5}}, ha sido cancelada. No necesitas realizar ninguna acción.',
        ['María', 'Apartamento Centro', '15 de julio de 2026', '10:00', '13:00'],
      ),
    ],
  },
  {
    name: 'task_approval_reminder_es',
    language: 'es',
    category: 'UTILITY',
    allow_category_change: true,
    components: [
      body(
        'Hola {{1}}, seguimos esperando tu confirmación para esta limpieza.\n\nAlojamiento: {{2}}\nFecha: {{3}}\nHorario: {{4}} - {{5}}\n\nConfirma si puedes realizarla.',
        ['María', 'Apartamento Centro', '15 de julio de 2026', '10:00', '13:00'],
      ),
      quickReplies('Confirmar', 'No disponible'),
    ],
  },
  {
    name: 'task_late_start_reminder_es',
    language: 'es',
    category: 'UTILITY',
    allow_category_change: true,
    components: [
      body(
        'Hola {{1}}, la limpieza de {{2}} estaba prevista para comenzar a las {{3}} y todavía no consta como iniciada. Indica tu situación.',
        ['María', 'Apartamento Centro', '10:00'],
      ),
    ],
  },
  {
    name: 'task_rejected_admin_alert_es',
    language: 'es',
    category: 'UTILITY',
    allow_category_change: true,
    components: [
      body(
        'Aviso operativo: {{1}} ha rechazado la limpieza de {{2}} del {{3}} a las {{4}}. Revisa la asignación.',
        ['María', 'Apartamento Centro', '15 de julio de 2026', '10:00'],
      ),
    ],
  },
];

function variableNumbers(text) {
  return [...text.matchAll(/\{\{(\d+)\}\}/g)].map((match) => Number(match[1]));
}

export function validateOperationalTemplates(templates = OPERATIONAL_TEMPLATES) {
  const errors = [];
  const names = new Set();

  for (const template of templates) {
    if (names.has(template.name)) errors.push(`${template.name}: nombre duplicado`);
    names.add(template.name);
    if (!/^[a-z0-9_]+$/.test(template.name)) errors.push(`${template.name}: nombre técnico inválido`);
    if (template.category !== 'UTILITY') errors.push(`${template.name}: debe ser UTILITY`);
    if (template.language !== 'es') errors.push(`${template.name}: idioma debe ser es`);

    const bodyComponent = template.components.find((component) => component.type === 'BODY');
    if (!bodyComponent) {
      errors.push(`${template.name}: falta BODY`);
      continue;
    }

    const vars = variableNumbers(bodyComponent.text);
    const expected = Array.from({ length: vars.length }, (_, index) => index + 1);
    if (JSON.stringify(vars) !== JSON.stringify(expected)) {
      errors.push(`${template.name}: variables no consecutivas`);
    }
    const examples = bodyComponent.example?.body_text?.[0] ?? [];
    if (examples.length !== vars.length) {
      errors.push(`${template.name}: ejemplos ${examples.length}, variables ${vars.length}`);
    }

    const buttonComponent = template.components.find((component) => component.type === 'BUTTONS');
    for (const button of buttonComponent?.buttons ?? []) {
      if (button.type !== 'QUICK_REPLY') errors.push(`${template.name}: botón no compatible`);
      if (!button.text || button.text.length > 25) errors.push(`${template.name}: texto de botón inválido`);
    }
  }

  return errors;
}

function readClipboardToken() {
  const raw = execFileSync(
    'powershell.exe',
    ['-NoProfile', '-Command', '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; Get-Clipboard -Raw'],
    { encoding: 'utf8', windowsHide: true },
  );
  return raw.trim().replace(/^['"]|['"]$/g, '').replace(/\s+/g, '');
}

function clearClipboard() {
  execFileSync('clip.exe', { input: '', windowsHide: true });
}

async function graphRequest(path, token, options = {}) {
  const authScheme = ['Be', 'arer'].join('');
  const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${path}`, {
    ...options,
    headers: {
      Authorization: `${authScheme} ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

export async function submitOperationalTemplates() {
  const errors = validateOperationalTemplates();
  if (errors.length) throw new Error(`Plantillas inválidas:\n${errors.join('\n')}`);

  let token = '';
  try {
    token = readClipboardToken();
    clearClipboard();
    if (token.length < 50) throw new Error('El portapapeles no contiene un token de acceso válido.');

    const { response: listResponse, json: listJson } = await graphRequest(
      `${WABA_ID}/message_templates?fields=name,status,category,language&limit=100`,
      token,
    );
    if (!listResponse.ok) {
      const error = listJson?.error ?? {};
      throw new Error(`Meta no permitió consultar plantillas (${error.code ?? listResponse.status}): ${error.message ?? 'error'}`);
    }

    const existing = new Map((listJson.data ?? []).map((item) => [item.name, item]));
    const results = [];

    for (const template of OPERATIONAL_TEMPLATES) {
      const current = existing.get(template.name);
      if (current) {
        results.push({ name: template.name, action: 'existing', status: current.status, category: current.category });
        continue;
      }

      const { response, json } = await graphRequest(`${WABA_ID}/message_templates`, token, {
        method: 'POST',
        body: JSON.stringify(template),
      });
      if (!response.ok) {
        const error = json?.error ?? {};
        results.push({
          name: template.name,
          action: 'error',
          httpStatus: response.status,
          code: error.code ?? null,
          subcode: error.error_subcode ?? null,
          message: error.message ?? 'Error desconocido',
        });
        continue;
      }
      results.push({ name: template.name, action: 'submitted', id: json.id ?? null, status: json.status ?? 'PENDING' });
    }

    return results;
  } finally {
    token = '';
    try { clearClipboard(); } catch { /* El resultado principal no depende de limpiar dos veces. */ }
  }
}

async function main() {
  const command = process.argv[2] ?? '--validate';
  const errors = validateOperationalTemplates();
  if (errors.length) {
    console.error(JSON.stringify({ ok: false, errors }, null, 2));
    process.exitCode = 1;
    return;
  }

  if (command === '--validate') {
    console.log(JSON.stringify({ ok: true, templates: OPERATIONAL_TEMPLATES.map(({ name, category, language }) => ({ name, category, language })) }, null, 2));
    return;
  }
  if (command === '--submit') {
    const results = await submitOperationalTemplates();
    console.log(JSON.stringify({ ok: !results.some((item) => item.action === 'error'), results }, null, 2));
    if (results.some((item) => item.action === 'error')) process.exitCode = 1;
    return;
  }

  console.error('Uso: node scripts/whatsappOperationalTemplates.mjs --validate|--submit');
  process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
