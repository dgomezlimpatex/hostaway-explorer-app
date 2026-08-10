import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');

const app = read('src/App.tsx');
const desktopNavigation = read('src/components/dashboard/DashboardSidebar.tsx');
const mobileNavigation = read('src/components/dashboard/MobileDashboardSidebar.tsx');
const roleBasedNavigation = read('src/components/navigation/RoleBasedNavigation.tsx');
const page = read('src/features/budget-estimator/BudgetEstimatorPage.tsx');

const normalizeWhitespace = (value) => value.replace(/\s+/g, ' ').trim();

const immediateGuardForCard = (source, href) => {
  const marker = `to="${href}"`;
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, `Debe existir la tarjeta ${href}`);

  const cardStart = source.lastIndexOf('<NavigationCard', markerIndex);
  assert.notEqual(cardStart, -1, `Debe existir NavigationCard para ${href}`);

  const sourceBeforeCard = source.slice(0, cardStart).trimEnd();
  return sourceBeforeCard.slice(sourceBeforeCard.lastIndexOf('\n') + 1).trim();
};

const assertBudgetCardUsesAdminModule = (source) => {
  assert.equal(
    immediateGuardForCard(source, '/presupuestador'),
    "{canAccessModule('admin') && (",
    'La tarjeta del Presupuestador debe usar inmediatamente el módulo admin',
  );
};

assert.match(app, /const BudgetEstimator = React\.lazy/);
assert.match(app, /path="\/presupuestador"/);
assert.match(app, /requiredModule="admin"[^>]*><BudgetEstimator/);

for (const navigation of [desktopNavigation, mobileNavigation]) {
  const budgetBlock = navigation.match(/const budgetItems: NavigationItem\[\] = \[([\s\S]*?)\n\];/)?.[1];
  assert.ok(budgetBlock, 'Debe existir el bloque de navegación del Presupuestador');
  assert.match(budgetBlock, /title: 'Presupuestador'/);
  assert.match(budgetBlock, /href: '\/presupuestador'/);
  assert.match(budgetBlock, /permission: 'admin-module'/);
  assert.doesNotMatch(budgetBlock, /permission: 'admin-only'/);
  const adminModuleCase = navigation.match(
    /case 'admin-module':([\s\S]*?)(?=\s*case 'admin-only':)/,
  )?.[1];
  assert.ok(adminModuleCase, 'Debe existir el case admin-module');
  assert.equal(
    normalizeWhitespace(adminModuleCase),
    "return canAccessModule('admin');",
    'admin-module debe delegar exclusivamente en el módulo admin',
  );
  assert.match(navigation, /renderNavigationSection\('Presupuestos'/);
}

assert.match(
  mobileNavigation,
  /const renderNavigationSection = \(title: string, items: NavigationItem\[\]\) => \{[\s\S]*?const filteredItems = filterItemsByPermission\(items\);[\s\S]*?if \(filteredItems\.length === 0\) return null;[\s\S]*?filteredItems\.map/,
  'La navegación móvil no debe renderizar encabezados de secciones sin elementos autorizados',
);

assertBudgetCardUsesAdminModule(roleBasedNavigation);

const cardStart = roleBasedNavigation.lastIndexOf(
  '<NavigationCard',
  roleBasedNavigation.indexOf('to="/presupuestador"'),
);
const guardLineStart = roleBasedNavigation.lastIndexOf('\n', cardStart - 1) + 1;
const mutatedRoleNavigation =
  roleBasedNavigation.slice(0, guardLineStart)
  + "          {isAdminOrManager() && (\n"
  + roleBasedNavigation.slice(cardStart);
assert.throws(
  () => assertBudgetCardUsesAdminModule(mutatedRoleNavigation),
  /debe usar inmediatamente el módulo admin/,
  'La regresión debe fallar si un manager vuelve a ver la tarjeta',
);
assert.match(page, /role="alert" aria-live="polite"/);
assert.match(page, /15,50 €\/h/);
assert.match(page, /1 €\/h de ruta/);
assert.match(page, /19,50 €\/h/);
assert.match(page, /Simulador sin guardado/);
assert.match(page, /Plantilla de tiempos de limpieza/);
assert.match(page, /Cocinas/);
assert.match(page, /Baños/);
assert.match(page, /Habitaciones/);
assert.match(page, /Camas de matrimonio/);
assert.match(page, /Camas individuales/);
assert.match(page, /Literas/);
assert.match(page, /Cada litera añade automáticamente dos camas individuales/);
assert.match(page, /Terrazas/);
assert.match(page, /Redondeo superior a 15 min/);
assert.match(page, /cleaningHours: timeCalculation\.data\.cleaningHours/);
assert.doesNotMatch(page, /id="cleaning-hours"/);
assert.match(page, /idPrefix="laundry"/);
assert.match(page, /idPrefix="amenities"/);
assert.match(page, /idPrefix="other"/);
assert.ok(page.includes('id={`${idPrefix}-coste`}'));
assert.ok(page.includes('id={`${idPrefix}-venta`}'));
assert.match(page, /Escenario mensual/);

console.log('budget-estimator-ui-contract: OK');
