export type LogisticsMode = 'provisional-hourly' | 'activity-based';
export type LogisticsDensity = 'A' | 'B' | 'C';

export interface LogisticsDensityMultipliers {
  A: number;
  B: number;
  C: number;
}

export interface LogisticsRates {
  preparationPerBag: number;
  stopFixed: number;
  kilometer: number;
  routeLaborPerHour: number;
  vehiclePerHour: number;
  warehousePerRotation: number;
  densityMultipliers: LogisticsDensityMultipliers;
}

export interface TouristLogisticsInput {
  mode: LogisticsMode;
  density: LogisticsDensity;
  bags: number;
  stops: number;
  kilometers: number;
  routeHours: number;
  rates: Partial<LogisticsRates>;
  salePrice?: number;
  provisionalHourlyAllocation?: number;
  cleaningHours?: number;
}

export interface TouristLogisticsCostResult {
  mode: LogisticsMode;
  density: LogisticsDensity;
  baseCost: number;
  densityMultiplier: number;
  totalCost: number;
  salePrice: number;
  contribution: number;
  breakdown: {
    preparation: number;
    stops: number;
    kilometers: number;
    routeLabor: number;
    vehicle: number;
    warehouse: number;
  };
}

export const DEFAULT_LOGISTICS_RATES: LogisticsRates = {
  preparationPerBag: 0.4,
  stopFixed: 8,
  kilometer: 0.5,
  routeLaborPerHour: 14.5,
  vehiclePerHour: 3,
  warehousePerRotation: 1,
  densityMultipliers: { A: 0.8, B: 1, C: 1.3 },
};

const MAX_ACTIVITY_VALUE = 1_000_000;

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const assertNonNegative = (label: string, value: number) => {
  if (!Number.isFinite(value) || value < 0 || value > MAX_ACTIVITY_VALUE) {
    throw new Error(`${label} debe ser un número finito no negativo dentro del límite operativo`);
  }
};

const assertMoney = (label: string, value: number) => {
  assertNonNegative(label, value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.toString())) {
    throw new Error(`${label} debe tener como máximo dos decimales`);
  }
};

export function calculateTouristLogisticsCost(input: TouristLogisticsInput): TouristLogisticsCostResult {
  if (!['A', 'B', 'C'].includes(input.density)) {
    throw new Error('La densidad logística debe ser A, B o C');
  }

  assertNonNegative('Las bolsas', input.bags);
  assertNonNegative('Las paradas', input.stops);
  assertNonNegative('Los kilómetros', input.kilometers);
  assertNonNegative('Las horas de ruta', input.routeHours);

  const rates: LogisticsRates = {
    ...DEFAULT_LOGISTICS_RATES,
    ...input.rates,
    densityMultipliers: {
      ...DEFAULT_LOGISTICS_RATES.densityMultipliers,
      ...(input.rates.densityMultipliers ?? {}),
    },
  };

  const rateValues: Array<[string, number]> = [
    ['El coste de preparación por bolsa', rates.preparationPerBag],
    ['El coste fijo por parada', rates.stopFixed],
    ['El coste por kilómetro', rates.kilometer],
    ['El coste de ruta por hora', rates.routeLaborPerHour],
    ['El coste de vehículo por hora', rates.vehiclePerHour],
    ['El coste de almacén por rotación', rates.warehousePerRotation],
  ];
  rateValues.forEach(([label, value]) => assertMoney(label, value));

  const multiplier = rates.densityMultipliers[input.density];
  assertNonNegative('El multiplicador de densidad', multiplier);
  if (multiplier <= 0) throw new Error('El multiplicador de densidad debe ser mayor que cero');

  const salePrice = input.salePrice ?? 0;
  assertMoney('El precio logístico de venta', salePrice);

  if (input.mode === 'provisional-hourly') {
    const cleaningHours = input.cleaningHours ?? 0;
    const hourlyAllocation = input.provisionalHourlyAllocation ?? 0;
    assertNonNegative('Las horas de limpieza', cleaningHours);
    assertMoney('La imputación provisional por hora', hourlyAllocation);
    const totalCost = roundMoney(cleaningHours * hourlyAllocation);
    return {
      mode: input.mode,
      density: input.density,
      baseCost: totalCost,
      densityMultiplier: 1,
      totalCost,
      salePrice,
      contribution: roundMoney(salePrice - totalCost),
      breakdown: {
        preparation: 0,
        stops: 0,
        kilometers: 0,
        routeLabor: 0,
        vehicle: 0,
        warehouse: 0,
      },
    };
  }

  const breakdown = {
    preparation: input.bags * rates.preparationPerBag,
    stops: input.stops * rates.stopFixed,
    kilometers: input.kilometers * rates.kilometer,
    routeLabor: input.routeHours * rates.routeLaborPerHour,
    vehicle: input.routeHours * rates.vehiclePerHour,
    warehouse: rates.warehousePerRotation,
  };
  const baseCost = roundMoney(Object.values(breakdown).reduce((sum, value) => sum + value, 0));
  const totalCost = roundMoney(baseCost * multiplier);

  return {
    mode: input.mode,
    density: input.density,
    baseCost,
    densityMultiplier: multiplier,
    totalCost,
    salePrice,
    contribution: roundMoney(salePrice - totalCost),
    breakdown: Object.fromEntries(
      Object.entries(breakdown).map(([key, value]) => [key, roundMoney(value)]),
    ) as TouristLogisticsCostResult['breakdown'],
  };
}
