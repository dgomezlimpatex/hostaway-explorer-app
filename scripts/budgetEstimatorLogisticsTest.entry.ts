import { calculateTouristApartmentBudget } from '../src/features/budget-estimator/budgetCalculator';
import { calculateTouristLogisticsCost, DEFAULT_LOGISTICS_RATES } from '../src/features/budget-estimator/logisticsCalculator';

export async function run(assert: typeof import('node:assert/strict')) {
  const activity = calculateTouristLogisticsCost({
    mode: 'activity-based',
    density: 'A',
    bags: 10,
    stops: 1,
    kilometers: 12,
    routeHours: 2,
    rates: {
      preparationPerBag: 0.4,
      stopFixed: 8,
      kilometer: 0.5,
      routeLaborPerHour: 14.5,
      vehiclePerHour: 3,
      warehousePerRotation: 1,
      densityMultipliers: { A: 0.8, B: 1, C: 1.3 },
    },
    salePrice: 75,
  });

  assert.equal(activity.baseCost, 54);
  assert.equal(activity.densityMultiplier, 0.8);
  assert.equal(activity.totalCost, 43.2);
  assert.equal(activity.salePrice, 75);
  assert.equal(activity.contribution, 31.8);

  const provisional = calculateTouristLogisticsCost({
    mode: 'provisional-hourly',
    density: 'C',
    bags: 1,
    stops: 1,
    kilometers: 99,
    routeHours: 99,
    rates: DEFAULT_LOGISTICS_RATES,
    provisionalHourlyAllocation: 2,
    cleaningHours: 2.25,
  });
  assert.equal(provisional.totalCost, 4.5);
  assert.equal(provisional.salePrice, 0);
  assert.equal(provisional.contribution, -4.5);

  assert.throws(
    () => calculateTouristLogisticsCost({
      mode: 'activity-based',
      density: 'A',
      bags: -1,
      stops: 1,
      kilometers: 1,
      routeHours: 1,
      rates: DEFAULT_LOGISTICS_RATES,
    }),
    /no negativo/,
  );

  const complete = calculateTouristApartmentBudget({
    cleaningHours: 1,
    logistics: {
      mode: 'activity-based',
      density: 'B',
      bags: 4,
      stops: 2,
      kilometers: 10,
      routeHours: 1,
      rates: {
        preparationPerBag: 1,
        stopFixed: 5,
        kilometer: 0.5,
        routeLaborPerHour: 10,
        vehiclePerHour: 2,
        warehousePerRotation: 1,
        densityMultipliers: { A: 0.8, B: 1, C: 1.2 },
      },
      salePrice: 30,
    },
  });
  assert.equal(complete.logistics.totalCost, 32);
  assert.equal(complete.rotation.totalCost, 47.5);
  assert.equal(complete.rotation.totalRevenue, 49.5);
  assert.equal(complete.rotation.contribution, 2);
}
