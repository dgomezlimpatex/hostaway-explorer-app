export interface CleaningFeatureCounts {
  kitchens: number;
  bathrooms: number;
  bedrooms: number;
  doubleBeds: number;
  singleBeds: number;
  bunkBeds: number;
  terraces: number;
}

export interface CleaningTimeTemplate {
  fixed: number;
  kitchen: number;
  bathroom: number;
  bedroom: number;
  doubleBed: number;
  singleBed: number;
  terrace: number;
}

export interface CleaningTimeEstimateInput {
  counts: CleaningFeatureCounts;
  minutes: CleaningTimeTemplate;
  roundingMinutes?: number;
}

export interface CleaningTimeEstimateResult {
  equivalentSingleBeds: number;
  lineMinutes: {
    fixed: number;
    kitchens: number;
    bathrooms: number;
    bedrooms: number;
    doubleBeds: number;
    singleBeds: number;
    bunkBeds: number;
    terraces: number;
  };
  rawMinutes: number;
  roundedMinutes: number;
  cleaningHours: number;
}

export const DEFAULT_CLEANING_FEATURE_COUNTS: CleaningFeatureCounts = {
  kitchens: 1,
  bathrooms: 1,
  bedrooms: 1,
  doubleBeds: 1,
  singleBeds: 0,
  bunkBeds: 0,
  terraces: 0,
};

export const DEFAULT_CLEANING_TIME_TEMPLATE: CleaningTimeTemplate = {
  fixed: 15,
  kitchen: 20,
  bathroom: 15,
  bedroom: 10,
  doubleBed: 10,
  singleBed: 7,
  terrace: 10,
};

const MAX_COUNT_PER_FEATURE = 100;
const MAX_MINUTES_PER_UNIT = 600;
const MAX_TOTAL_MINUTES = 60_000;

const assertNonNegativeInteger = (label: string, value: number, maximum: number) => {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new Error(`${label} debe ser un entero no negativo dentro del límite operativo`);
  }
};

const multiplyMinutes = (label: string, count: number, minutesPerUnit: number) => {
  const result = count * minutesPerUnit;
  if (!Number.isSafeInteger(result) || result > MAX_TOTAL_MINUTES) {
    throw new Error(`${label} supera el límite operativo de tiempo`);
  }
  return result;
};

export function calculateCleaningTimeEstimate({
  counts,
  minutes,
  roundingMinutes = 15,
}: CleaningTimeEstimateInput): CleaningTimeEstimateResult {
  Object.entries(counts).forEach(([key, value]) => {
    assertNonNegativeInteger(`La cantidad ${key}`, value, MAX_COUNT_PER_FEATURE);
  });
  Object.entries(minutes).forEach(([key, value]) => {
    if (!Number.isSafeInteger(value) || value < 0 || value > MAX_MINUTES_PER_UNIT) {
      throw new Error(`El tiempo ${key} debe indicarse en minutos enteros dentro del límite operativo`);
    }
  });
  if (!Number.isSafeInteger(roundingMinutes) || roundingMinutes <= 0 || roundingMinutes > 60) {
    throw new Error('El bloque de redondeo debe indicarse en minutos enteros entre 1 y 60');
  }

  const equivalentSingleBeds = counts.singleBeds + counts.bunkBeds * 2;
  assertNonNegativeInteger(
    'El total equivalente de camas individuales',
    equivalentSingleBeds,
    MAX_COUNT_PER_FEATURE * 3,
  );

  const lineMinutes = {
    fixed: minutes.fixed,
    kitchens: multiplyMinutes('El tiempo de cocinas', counts.kitchens, minutes.kitchen),
    bathrooms: multiplyMinutes('El tiempo de baños', counts.bathrooms, minutes.bathroom),
    bedrooms: multiplyMinutes('El tiempo de habitaciones', counts.bedrooms, minutes.bedroom),
    doubleBeds: multiplyMinutes('El tiempo de camas matrimoniales', counts.doubleBeds, minutes.doubleBed),
    singleBeds: multiplyMinutes('El tiempo de camas individuales', counts.singleBeds, minutes.singleBed),
    bunkBeds: multiplyMinutes('El tiempo de literas', counts.bunkBeds * 2, minutes.singleBed),
    terraces: multiplyMinutes('El tiempo de terrazas', counts.terraces, minutes.terrace),
  };

  const rawMinutes = Object.values(lineMinutes).reduce((total, value) => total + value, 0);
  if (!Number.isSafeInteger(rawMinutes) || rawMinutes <= 0 || rawMinutes > MAX_TOTAL_MINUTES) {
    throw new Error('El tiempo total debe ser mayor que cero y estar dentro del límite operativo');
  }

  const roundedMinutes = Math.ceil(rawMinutes / roundingMinutes) * roundingMinutes;
  if (!Number.isSafeInteger(roundedMinutes) || roundedMinutes > MAX_TOTAL_MINUTES) {
    throw new Error('El tiempo redondeado supera el límite operativo');
  }

  return {
    equivalentSingleBeds,
    lineMinutes,
    rawMinutes,
    roundedMinutes,
    cleaningHours: roundedMinutes / 60,
  };
}
