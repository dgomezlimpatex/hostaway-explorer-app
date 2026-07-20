// Semántica pura del efecto externo Meta. Separada del cliente HTTP para que
// pueda probarse sin red, credenciales ni runtime Deno.
export function isAmbiguousWhatsAppHttpStatus(status: number): boolean {
  return status >= 500 || [408, 429].includes(status);
}
