// Semántica pura del efecto externo Resend. El SDK devuelve errores HTTP como
// valores (no siempre como excepciones) e incluye statusCode cuando lo conoce.
export interface ResendErrorLike {
  statusCode?: number | null;
  message?: string | null;
}

export interface ResendSendResponseLike {
  data?: { id?: string | null } | null;
  error?: ResendErrorLike | null;
}

export interface ResendSendOutcome {
  effectUncertain: boolean;
  providerMessageId: string | null;
  errorMessage: string | null;
}

export function isAmbiguousResendError(error: ResendErrorLike | null | undefined): boolean {
  const status = error?.statusCode;
  return !Number.isInteger(status) || status === 408 || status === 429 || (status as number) >= 500;
}

export function classifyResendSendResponse(response: ResendSendResponseLike): ResendSendOutcome {
  if (response.error) {
    return {
      effectUncertain: isAmbiguousResendError(response.error),
      providerMessageId: null,
      errorMessage: response.error.message ?? JSON.stringify(response.error),
    };
  }

  const providerMessageId = response.data?.id?.trim() || null;
  if (providerMessageId) {
    return { effectUncertain: false, providerMessageId, errorMessage: null };
  }

  return {
    effectUncertain: true,
    providerMessageId: null,
    errorMessage: 'Resend respondió sin ID de mensaje; efecto incierto',
  };
}
