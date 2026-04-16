// Extended color palette for clients with many properties
// Uses HSL values that are visually distinct
const GENERATED_HUES = [
  220, 340, 140, 30, 270,   // chart-like base hues
  180, 60, 310, 100, 200,
  0, 160, 50, 240, 290,
  120, 350, 80, 190, 260,
];

export const generatePropertyColor = (index: number) => {
  const hue = GENERATED_HUES[index % GENERATED_HUES.length];
  const satShift = Math.floor(index / GENERATED_HUES.length) * 10;
  const sat = Math.max(40, 65 - satShift);
  const light = 50;
  return {
    bg: `hsla(${hue}, ${sat}%, ${light}%, 0.12)`,
    border: `hsla(${hue}, ${sat}%, ${light}%, 0.4)`,
    text: `hsl(${hue}, ${sat}%, ${light}%)`,
  };
};

export type PropertyColor = ReturnType<typeof generatePropertyColor>;

export const buildPropertyColorMap = (
  propertyIds: string[]
): Map<string, PropertyColor> => {
  const map = new Map<string, PropertyColor>();
  propertyIds.forEach((id, i) => {
    if (!map.has(id)) {
      map.set(id, generatePropertyColor(i));
    }
  });
  return map;
};
