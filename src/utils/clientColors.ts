// Deterministic color palette for clients based on client ID.
// Used to color-code task cards and the calendar legend.

const PALETTE: Array<{
  bg: string;          // tarjeta (claro)
  border: string;      // borde lateral (saturado)
  dot: string;         // punto de leyenda
  text: string;        // texto sobre fondo claro
  ring: string;        // anillo en hover
}> = [
  { bg: 'hsl(212, 95%, 94%)', border: 'hsl(212, 85%, 55%)', dot: 'hsl(212, 85%, 55%)', text: 'hsl(212, 70%, 25%)', ring: 'hsl(212, 85%, 70%)' },
  { bg: 'hsl(160, 70%, 92%)', border: 'hsl(160, 65%, 42%)', dot: 'hsl(160, 65%, 42%)', text: 'hsl(160, 70%, 22%)', ring: 'hsl(160, 65%, 60%)' },
  { bg: 'hsl(28, 95%, 92%)',  border: 'hsl(28, 90%, 55%)',  dot: 'hsl(28, 90%, 55%)',  text: 'hsl(28, 80%, 28%)',  ring: 'hsl(28, 90%, 70%)' },
  { bg: 'hsl(266, 80%, 94%)', border: 'hsl(266, 65%, 60%)', dot: 'hsl(266, 65%, 60%)', text: 'hsl(266, 60%, 30%)', ring: 'hsl(266, 65%, 75%)' },
  { bg: 'hsl(346, 90%, 94%)', border: 'hsl(346, 80%, 60%)', dot: 'hsl(346, 80%, 60%)', text: 'hsl(346, 70%, 30%)', ring: 'hsl(346, 80%, 75%)' },
  { bg: 'hsl(186, 80%, 92%)', border: 'hsl(186, 70%, 45%)', dot: 'hsl(186, 70%, 45%)', text: 'hsl(186, 70%, 22%)', ring: 'hsl(186, 70%, 60%)' },
  { bg: 'hsl(48, 95%, 90%)',  border: 'hsl(42, 90%, 50%)',  dot: 'hsl(42, 90%, 50%)',  text: 'hsl(38, 80%, 28%)',  ring: 'hsl(42, 90%, 65%)' },
  { bg: 'hsl(132, 70%, 92%)', border: 'hsl(132, 55%, 42%)', dot: 'hsl(132, 55%, 42%)', text: 'hsl(132, 60%, 22%)', ring: 'hsl(132, 55%, 60%)' },
  { bg: 'hsl(304, 75%, 94%)', border: 'hsl(304, 65%, 58%)', dot: 'hsl(304, 65%, 58%)', text: 'hsl(304, 60%, 30%)', ring: 'hsl(304, 65%, 75%)' },
  { bg: 'hsl(232, 85%, 94%)', border: 'hsl(232, 75%, 60%)', dot: 'hsl(232, 75%, 60%)', text: 'hsl(232, 65%, 30%)', ring: 'hsl(232, 75%, 75%)' },
];

export type ClientColor = typeof PALETTE[number];

const cache = new Map<string, ClientColor>();

const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

export const getClientColor = (clientId: string | null | undefined): ClientColor => {
  const key = clientId || '__unassigned__';
  const cached = cache.get(key);
  if (cached) return cached;
  const idx = hashString(key) % PALETTE.length;
  const color = PALETTE[idx];
  cache.set(key, color);
  return color;
};
