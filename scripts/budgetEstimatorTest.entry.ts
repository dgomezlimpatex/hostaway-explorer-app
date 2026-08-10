import { calculateTouristApartmentBudget } from '../src/features/budget-estimator/budgetCalculator';
import {
  calculateCleaningTimeEstimate,
  DEFAULT_CLEANING_TIME_TEMPLATE,
} from '../src/features/budget-estimator/cleaningTimeEstimator';
import { canRoleAccessModule } from '../src/lib/rolePermissions';

export async function run(assert: typeof import('node:assert/strict')) {
  assert.equal(canRoleAccessModule('admin', 'admin'), true);
  for (const role of ['manager', 'supervisor', 'cleaner', 'logistics', 'unknown', null]) {
    assert.equal(
      canRoleAccessModule(role, 'admin'),
      false,
      `El rol ${role ?? 'sin rol'} no debe acceder al módulo admin`,
    );
  }

  const timeEstimate = calculateCleaningTimeEstimate({
    counts: {
      kitchens: 1,
      bathrooms: 2,
      bedrooms: 2,
      doubleBeds: 1,
      singleBeds: 2,
      bunkBeds: 1,
      terraces: 1,
    },
    minutes: DEFAULT_CLEANING_TIME_TEMPLATE,
  });
  assert.equal(timeEstimate.equivalentSingleBeds, 4);
  assert.equal(timeEstimate.lineMinutes.kitchens, 20);
  assert.equal(timeEstimate.lineMinutes.bathrooms, 30);
  assert.equal(timeEstimate.lineMinutes.bedrooms, 20);
  assert.equal(timeEstimate.lineMinutes.doubleBeds, 10);
  assert.equal(timeEstimate.lineMinutes.singleBeds, 14);
  assert.equal(timeEstimate.lineMinutes.bunkBeds, 14);
  assert.equal(timeEstimate.lineMinutes.terraces, 10);
  assert.equal(timeEstimate.rawMinutes, 133);
  assert.equal(timeEstimate.roundedMinutes, 135);
  assert.equal(timeEstimate.cleaningHours, 2.25);

  assert.throws(
    () => calculateCleaningTimeEstimate({
      counts: { kitchens: 0, bathrooms: 0, bedrooms: 0, doubleBeds: 0, singleBeds: 0, bunkBeds: -1, terraces: 0 },
      minutes: DEFAULT_CLEANING_TIME_TEMPLATE,
    }),
    /entero no negativo/,
  );
  assert.throws(
    () => calculateCleaningTimeEstimate({
      counts: { kitchens: 1, bathrooms: 0, bedrooms: 0, doubleBeds: 0, singleBeds: 0, bunkBeds: 0, terraces: 0 },
      minutes: { ...DEFAULT_CLEANING_TIME_TEMPLATE, kitchen: 10.5 },
    }),
    /minutos enteros/,
  );

  const oneHour = calculateTouristApartmentBudget({ cleaningHours: 1 });
  assert.equal(oneHour.cleaning.laborCost, 14.5);
  assert.equal(oneHour.cleaning.routeAllocation, 1);
  assert.equal(oneHour.cleaning.totalCost, 15.5);
  assert.equal(oneHour.cleaning.salePrice, 19.5);
  assert.equal(oneHour.rotation.contribution, 4);

  const result = calculateTouristApartmentBudget({ cleaningHours: 2 });

  assert.equal(result.cleaning.laborCost, 29);
  assert.equal(result.cleaning.routeAllocation, 2);
  assert.equal(result.cleaning.totalCost, 31);
  assert.equal(result.cleaning.salePrice, 39);
  assert.equal(result.rotation.totalCost, 31);
  assert.equal(result.rotation.totalRevenue, 39);
  assert.equal(result.rotation.contribution, 8);

  const completeRotation = calculateTouristApartmentBudget({
    cleaningHours: 2.5,
    monthlyRotations: 12,
    laundry: { cost: 8, salePrice: 11 },
    amenities: { cost: 2.25, salePrice: 4.5 },
    other: { cost: 1.5, salePrice: 3 },
  });

  assert.equal(completeRotation.cleaning.totalCost, 38.75);
  assert.equal(completeRotation.cleaning.salePrice, 48.75);
  assert.equal(completeRotation.rotation.totalCost, 50.5);
  assert.equal(completeRotation.rotation.totalRevenue, 67.25);
  assert.equal(completeRotation.rotation.contribution, 16.75);
  assert.equal(completeRotation.rotation.marginPercentage, 24.91);
  assert.equal(completeRotation.monthly.totalCost, 606);
  assert.equal(completeRotation.monthly.totalRevenue, 807);
  assert.equal(completeRotation.monthly.contribution, 201);

  const maximumPositiveMargin = calculateTouristApartmentBudget({
    cleaningHours: 1_000,
    monthlyRotations: 10_000,
    rates: {
      laborCostPerHour: 0,
      routeAllocationPerHour: 0,
      cleaningSalePricePerHour: 100_000,
    },
  });
  assert.equal(maximumPositiveMargin.monthly.marginPercentage, 100);

  const maximumNegativeMargin = calculateTouristApartmentBudget({
    cleaningHours: 1_000,
    monthlyRotations: 10_000,
    rates: {
      laborCostPerHour: 100_000,
      routeAllocationPerHour: 0,
      cleaningSalePricePerHour: 1,
    },
  });
  assert.equal(maximumNegativeMargin.monthly.marginPercentage, -9_999_900);

  assert.throws(
    () => calculateTouristApartmentBudget({ cleaningHours: 1.1 }),
    /incrementos de 0,25 horas/,
  );
  assert.throws(
    () => calculateTouristApartmentBudget({ cleaningHours: -1 }),
    /mayor que cero/,
  );
  assert.throws(
    () => calculateTouristApartmentBudget({
      cleaningHours: 1,
      laundry: { cost: 5, salePrice: -1 },
    }),
    /no puede ser negativo/,
  );

  const customClient = calculateTouristApartmentBudget({
    cleaningHours: 2,
    rates: {
      laborCostPerHour: 14.75,
      routeAllocationPerHour: 1.25,
      cleaningSalePricePerHour: 21,
    },
  });
  assert.equal(customClient.cleaning.laborCost, 29.5);
  assert.equal(customClient.cleaning.routeAllocation, 2.5);
  assert.equal(customClient.cleaning.totalCost, 32);
  assert.equal(customClient.cleaning.salePrice, 42);
  assert.equal(customClient.rotation.contribution, 10);

  assert.throws(
    () => calculateTouristApartmentBudget({
      cleaningHours: 0.25,
      laundry: { cost: 1.005, salePrice: 0 },
    }),
    /máximo dos decimales/,
  );

  assert.throws(
    () => calculateTouristApartmentBudget({
      cleaningHours: 1e308,
    }),
    /rango seguro/,
  );
  assert.throws(
    () => calculateTouristApartmentBudget({
      cleaningHours: 0.25,
      rates: { laborCostPerHour: 1e308 },
    }),
    /rango seguro/,
  );
  assert.throws(
    () => calculateTouristApartmentBudget({
      cleaningHours: 0.25,
      laundry: { cost: 1e308, salePrice: 0 },
    }),
    /rango seguro/,
  );
  assert.throws(
    () => calculateTouristApartmentBudget({
      cleaningHours: 0.25,
      monthlyRotations: Number.MAX_SAFE_INTEGER + 1,
    }),
    /límite operativo/,
  );
  assert.throws(
    () => calculateTouristApartmentBudget({
      cleaningHours: 0.25,
      monthlyRotations: 100_001,
      laundry: { cost: 1, salePrice: 1 },
    }),
    /límite operativo/,
  );

  const commercialHalfCent = calculateTouristApartmentBudget({
    cleaningHours: 0.25,
    rates: {
      laborCostPerHour: 40.3,
      routeAllocationPerHour: 0,
      cleaningSalePricePerHour: 0,
    },
  });
  assert.equal(commercialHalfCent.cleaning.laborCost, 10.08);
  assert.equal(commercialHalfCent.rotation.totalCost, 10.08);
  assert.equal(commercialHalfCent.rotation.contribution, -10.08);

  assert.throws(
    () => calculateTouristApartmentBudget({
      cleaningHours: 0.25,
      laundry: { cost: 10_000_000_000_000.125, salePrice: 0 },
    }),
    /máximo dos decimales|límite operativo/,
  );
  assert.throws(
    () => calculateTouristApartmentBudget({
      cleaningHours: 10_000.25,
    }),
    /límite operativo/,
  );
  assert.throws(
    () => calculateTouristApartmentBudget({
      cleaningHours: 0.25,
      laundry: { cost: 1_000_000.01, salePrice: 0 },
    }),
    /límite operativo/,
  );

  const centConsistent = calculateTouristApartmentBudget({
    cleaningHours: 0.25,
    monthlyRotations: 1,
    laundry: { cost: 1.01, salePrice: 0 },
  });
  assert.equal(centConsistent.rotation.totalCost, 4.89);
  assert.equal(centConsistent.rotation.totalRevenue, 4.88);
  assert.equal(centConsistent.rotation.contribution, -0.01);
  assert.deepEqual(centConsistent.monthly, centConsistent.rotation);
}
