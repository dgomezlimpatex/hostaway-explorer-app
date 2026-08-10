import {
  calculateTouristLogisticsCost,
  DEFAULT_LOGISTICS_RATES,
  TouristLogisticsCostResult,
  TouristLogisticsInput,
} from './logisticsCalculator';

export interface BudgetRates {
  laborCostPerHour: number;
  routeAllocationPerHour: number;
  cleaningSalePricePerHour: number;
}

export const DEFAULT_BUDGET_RATES: BudgetRates = {
  laborCostPerHour: 14.5,
  routeAllocationPerHour: 1,
  cleaningSalePricePerHour: 19.5,
};

export interface BudgetLineInput {
  cost: number;
  salePrice: number;
}

export interface TouristApartmentBudgetInput {
  cleaningHours: number;
  monthlyRotations?: number;
  rates?: Partial<BudgetRates>;
  logistics?: TouristLogisticsInput;
  laundry?: BudgetLineInput;
  amenities?: BudgetLineInput;
  other?: BudgetLineInput;
}

interface BudgetTotals {
  totalCost: number;
  totalRevenue: number;
  contribution: number;
  marginPercentage: number;
}

export interface TouristApartmentBudgetResult {
  cleaning: {
    laborCost: number;
    routeAllocation: number;
    totalCost: number;
    salePrice: number;
  };
  rotation: BudgetTotals;
  monthly: BudgetTotals;
  logistics: TouristLogisticsCostResult;
}

const MAX_HOURS_PER_ROTATION = 1_000;
const MAX_MONTHLY_ROTATIONS = 10_000;
const MAX_MONEY_INPUT_EUROS = 100_000;
const CENTS_PER_EURO = 100;
const QUARTERS_PER_HOUR = 4;

const assertSafeInteger = (label: string, value: number) => {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} está fuera del rango seguro de cálculo`);
  }
};

const assertMoneyInput = (label: string, value: number) => {
  if (!Number.isFinite(value) || value > MAX_MONEY_INPUT_EUROS) {
    throw new Error(`${label} está fuera del rango seguro y del límite operativo`);
  }
  if (value < 0) {
    throw new Error(`${label} no puede ser negativo`);
  }

  const decimalRepresentation = value.toString();
  if (!/^\d+(?:\.\d{1,2})?$/.test(decimalRepresentation)) {
    throw new Error(`${label} debe tener como máximo dos decimales`);
  }
};

const toCents = (label: string, value: number) => {
  assertMoneyInput(label, value);
  const cents = Math.round(value * CENTS_PER_EURO);
  assertSafeInteger(label, cents);
  return cents;
};

const fromCents = (cents: number) => {
  assertSafeInteger('El resultado', cents);
  return cents / CENTS_PER_EURO;
};

const addSafeIntegers = (label: string, ...values: number[]) => {
  const result = values.reduce((sum, value) => sum + value, 0);
  assertSafeInteger(label, result);
  return result;
};

const multiplySafeIntegers = (label: string, left: number, right: number) => {
  const result = left * right;
  assertSafeInteger(label, result);
  return result;
};

const divideAndRoundHalfAwayFromZero = (
  label: string,
  numerator: number,
  denominator: number,
) => {
  assertSafeInteger(label, numerator);
  const sign = Math.sign(numerator);
  const rounded = Math.floor((Math.abs(numerator) + denominator / 2) / denominator);
  const result = sign * rounded;
  assertSafeInteger(label, result);
  return result;
};

const rateForQuarterHours = (label: string, rateCents: number, quarterHours: number) => {
  const numerator = multiplySafeIntegers(label, rateCents, quarterHours);
  return divideAndRoundHalfAwayFromZero(label, numerator, QUARTERS_PER_HOUR);
};

const divideBigIntHalfAwayFromZero = (numerator: bigint, denominator: bigint) => {
  const sign = numerator < 0n ? -1n : 1n;
  const absoluteNumerator = numerator < 0n ? -numerator : numerator;
  const rounded = (absoluteNumerator * 2n + denominator) / (denominator * 2n);
  return sign * rounded;
};

const marginPercentageFromCents = (contributionCents: number, revenueCents: number) => {
  if (revenueCents === 0) return 0;

  const basisPoints = divideBigIntHalfAwayFromZero(
    BigInt(contributionCents) * 10_000n,
    BigInt(revenueCents),
  );
  const percentage = Number(basisPoints) / 100;
  if (!Number.isFinite(percentage)) {
    throw new Error('El porcentaje de margen está fuera del rango seguro de cálculo');
  }
  return percentage;
};

const buildTotalsFromCents = (totalCostCents: number, totalRevenueCents: number): BudgetTotals => {
  assertSafeInteger('El coste total', totalCostCents);
  assertSafeInteger('La venta total', totalRevenueCents);
  const contributionCents = addSafeIntegers(
    'La contribución',
    totalRevenueCents,
    -totalCostCents,
  );

  return {
    totalCost: fromCents(totalCostCents),
    totalRevenue: fromCents(totalRevenueCents),
    contribution: fromCents(contributionCents),
    marginPercentage: marginPercentageFromCents(contributionCents, totalRevenueCents),
  };
};

const lineToCents = (label: string, line?: BudgetLineInput) => {
  if (!line) return { cost: 0, salePrice: 0 };
  return {
    cost: toCents(`El coste de ${label}`, line.cost),
    salePrice: toCents(`El precio de ${label}`, line.salePrice),
  };
};

export function calculateTouristApartmentBudget(
  input: TouristApartmentBudgetInput,
): TouristApartmentBudgetResult {
  if (!Number.isFinite(input.cleaningHours) || input.cleaningHours <= 0) {
    throw new Error('Las horas de limpieza deben ser un número mayor que cero');
  }
  if (input.cleaningHours > MAX_HOURS_PER_ROTATION) {
    throw new Error('Las horas de limpieza superan el rango seguro o el límite operativo');
  }

  const quarterHours = input.cleaningHours * QUARTERS_PER_HOUR;
  if (!Number.isInteger(quarterHours)) {
    throw new Error('Las horas de limpieza deben indicarse en incrementos de 0,25 horas');
  }
  assertSafeInteger('Las horas de limpieza', quarterHours);

  const monthlyRotations = input.monthlyRotations ?? 1;
  if (
    !Number.isSafeInteger(monthlyRotations)
    || monthlyRotations <= 0
    || monthlyRotations > MAX_MONTHLY_ROTATIONS
  ) {
    throw new Error('Las rotaciones mensuales superan el límite operativo permitido');
  }

  const rates: BudgetRates = { ...DEFAULT_BUDGET_RATES, ...input.rates };
  const laborRateCents = toCents('El coste laboral por hora', rates.laborCostPerHour);
  const routeRateCents = toCents('La imputación de ruta por hora', rates.routeAllocationPerHour);
  const saleRateCents = toCents('El precio de venta por hora', rates.cleaningSalePricePerHour);

  const laborCostCents = rateForQuarterHours(
    'El coste laboral',
    laborRateCents,
    quarterHours,
  );
  const routeAllocationCents = rateForQuarterHours(
    'La imputación de ruta',
    routeRateCents,
    quarterHours,
  );
  const cleaningCostCents = addSafeIntegers(
    'El coste de limpieza',
    laborCostCents,
    routeAllocationCents,
  );
  const cleaningSaleCents = rateForQuarterHours(
    'La venta de limpieza',
    saleRateCents,
    quarterHours,
  );

  const laundry = lineToCents('lavandería', input.laundry);
  const amenities = lineToCents('amenities', input.amenities);
  const other = lineToCents('otros conceptos', input.other);
  const logistics = input.logistics
    ? calculateTouristLogisticsCost({
      ...input.logistics,
      rates: {
        ...DEFAULT_LOGISTICS_RATES,
        ...input.logistics.rates,
      },
      cleaningHours: input.logistics.cleaningHours ?? input.cleaningHours,
      provisionalHourlyAllocation:
        input.logistics.provisionalHourlyAllocation ?? rates.routeAllocationPerHour,
    })
    : calculateTouristLogisticsCost({
      mode: 'provisional-hourly',
      density: 'B',
      bags: 0,
      stops: 0,
      kilometers: 0,
      routeHours: 0,
      rates: DEFAULT_LOGISTICS_RATES,
      provisionalHourlyAllocation: 0,
      cleaningHours: 0,
    });

  const activityLogisticsCostCents = logistics.mode === 'activity-based'
    ? toCents('El coste logístico', logistics.totalCost)
    : 0;
  const activityLogisticsSaleCents = logistics.mode === 'activity-based'
    ? toCents('El precio logístico', logistics.salePrice)
    : 0;

  const rotationCostCents = addSafeIntegers(
    'El coste por rotación',
    cleaningCostCents,
    activityLogisticsCostCents,
    laundry.cost,
    amenities.cost,
    other.cost,
  );
  const rotationRevenueCents = addSafeIntegers(
    'La venta por rotación',
    cleaningSaleCents,
    activityLogisticsSaleCents,
    laundry.salePrice,
    amenities.salePrice,
    other.salePrice,
  );
  const rotation = buildTotalsFromCents(rotationCostCents, rotationRevenueCents);

  const monthlyCostCents = multiplySafeIntegers(
    'El coste mensual',
    rotationCostCents,
    monthlyRotations,
  );
  const monthlyRevenueCents = multiplySafeIntegers(
    'La venta mensual',
    rotationRevenueCents,
    monthlyRotations,
  );

  return {
    cleaning: {
      laborCost: fromCents(laborCostCents),
      routeAllocation: fromCents(routeAllocationCents),
      totalCost: fromCents(cleaningCostCents),
      salePrice: fromCents(cleaningSaleCents),
    },
    rotation,
    monthly: buildTotalsFromCents(monthlyCostCents, monthlyRevenueCents),
    logistics,
  };
}
