// Cliente WhatsApp Cloud API (Deno). Modo PREPARACIÓN:
//  - si !isWhatsAppLive() => dry-run: NO llama a Meta, devuelve status 'skipped'.
//  - si live => POST a Graph API. Nunca loguea el token ni secretos.

import { getWhatsAppConfig, isWhatsAppLive } from './featureFlags.ts';
import { isE164 } from './phone.ts';
import { buildBodyComponent } from './whatsappTemplates.ts';

export interface SendTemplateParams {
  to: string;
  templateName: string;
  languageCode: string;
  bodyParameters: string[];
  /** Payloads compactos para botones quick-reply, ej: 'approve:<taskId>:<nonce>'. */
  buttonPayloads?: string[];
  /** Clave de idempotencia (informativa; Meta no la usa nativamente). */
  idempotencyKey?: string;
}

export interface SendTemplateResult {
  ok: boolean;
  dryRun: boolean;
  status: 'sent' | 'skipped' | 'failed';
  providerMessageId: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  /** Respuesta cruda de Meta (sin secretos). */
  response?: Record<string, unknown>;
}

export async function sendWhatsAppTemplateMessage(
  params: SendTemplateParams,
): Promise<SendTemplateResult> {
  const { to, templateName, languageCode, bodyParameters, buttonPayloads } = params;

  if (!isE164(to)) {
    return {
      ok: false,
      dryRun: false,
      status: 'failed',
      providerMessageId: null,
      errorCode: 'invalid_phone',
      errorMessage: 'El teléfono destino no está en formato E.164.',
    };
  }

  // Modo preparación / dry-run: no enviamos nada a Meta.
  if (!isWhatsAppLive()) {
    return {
      ok: true,
      dryRun: true,
      status: 'skipped',
      providerMessageId: null,
      errorMessage: 'WhatsApp no está activo (modo preparación / dry-run).',
    };
  }

  const cfg = getWhatsAppConfig();
  const url = `https://graph.facebook.com/${cfg.graphApiVersion}/${cfg.phoneNumberId}/messages`;

  const components: unknown[] = [];
  if (bodyParameters && bodyParameters.length > 0) {
    components.push(buildBodyComponent(bodyParameters));
  }
  if (buttonPayloads && buttonPayloads.length > 0) {
    buttonPayloads.forEach((payload, index) => {
      components.push({
        type: 'button',
        sub_type: 'quick_reply',
        index: String(index),
        parameters: [{ type: 'payload', payload }],
      });
    });
  }

  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  };

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfg.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const json = (await resp.json().catch(() => ({}))) as Record<string, unknown>;

    if (!resp.ok) {
      const err = (json?.error ?? {}) as Record<string, unknown>;
      // No logueamos el token; solo el estado y el mensaje de error de Meta.
      console.error('WhatsApp send error', {
        httpStatus: resp.status,
        code: err?.code,
        message: err?.message,
      });
      return {
        ok: false,
        dryRun: false,
        status: 'failed',
        providerMessageId: null,
        errorCode: String(err?.code ?? resp.status),
        errorMessage: String(err?.message ?? `HTTP ${resp.status}`),
        response: json,
      };
    }

    const messages = (json?.messages ?? []) as Array<{ id?: string }>;
    const providerMessageId = messages[0]?.id ?? null;
    if (!providerMessageId) {
      return {
        ok: false,
        dryRun: false,
        status: 'failed',
        providerMessageId: null,
        errorCode: 'missing_provider_message_id',
        errorMessage: 'Meta aceptó la petición sin devolver un identificador de mensaje.',
        response: json,
      };
    }
    return {
      ok: true,
      dryRun: false,
      status: 'sent',
      providerMessageId,
      response: json,
    };
  } catch (e) {
    return {
      ok: false,
      dryRun: false,
      status: 'failed',
      providerMessageId: null,
      errorCode: 'network_error',
      errorMessage: e instanceof Error ? e.message : String(e),
    };
  }
}
