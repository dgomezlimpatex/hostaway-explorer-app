import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');
const exists = (relativePath) => existsSync(join(root, relativePath));

const appRoutes = read('src/App.tsx');
const hooks = read('src/hooks/useOperationalPlanning.ts');
const service = read('src/services/planning/operationalPlanningService.ts');
const propertyGroupsPage = read('src/components/property-groups/PropertyGroupsPage.tsx');
const propertyGroupDetails = read('src/components/property-groups/PropertyGroupDetails.tsx');
const planningTaskCard = read('src/components/cleaning-planning/PlanningTaskCard.tsx');
const operationalTypes = read('src/types/operationalPlanning.ts');

const requiredFiles = [
  'src/pages/PlanningBuildingDetail.tsx',
  'src/components/planning/building-crm/BuildingCrmPage.tsx',
  'src/components/planning/building-crm/BuildingCrmHeader.tsx',
  'src/components/planning/building-crm/BuildingCrmKpis.tsx',
  'src/components/planning/building-crm/BuildingDemandCalendar.tsx',
  'src/components/planning/building-crm/BuildingDecisionList.tsx',
  'src/components/planning/building-crm/BuildingTeamPanel.tsx',
  'src/components/planning/building-crm/BuildingPropertiesPanel.tsx',
  'src/services/planning/buildingCrmAggregator.ts',
];

for (const file of requiredFiles) {
  assert.ok(exists(file), `Missing building CRM implementation file: ${file}`);
}

const page = read('src/components/planning/building-crm/BuildingCrmPage.tsx');
const header = read('src/components/planning/building-crm/BuildingCrmHeader.tsx');
const kpis = read('src/components/planning/building-crm/BuildingCrmKpis.tsx');
const calendar = read('src/components/planning/building-crm/BuildingDemandCalendar.tsx');
const decisions = read('src/components/planning/building-crm/BuildingDecisionList.tsx');
const team = read('src/components/planning/building-crm/BuildingTeamPanel.tsx');
const properties = read('src/components/planning/building-crm/BuildingPropertiesPanel.tsx');

assert.match(operationalTypes, /export interface PlanningBuildingCrmProfile/, 'Types must define PlanningBuildingCrmProfile');
assert.match(operationalTypes, /PlanningBuildingCrmSummary/, 'Types must define summary contract');
assert.match(operationalTypes, /PlanningBuildingCrmDecision/, 'Types must define decision contract');
assert.match(service, /getBuildingCrmProfile\(input: \{[\s\S]*propertyGroupId: string[\s\S]*dateFrom: string[\s\S]*dateTo: string/s, 'operationalPlanningService must expose getBuildingCrmProfile');
assert.match(service, /loadMonthlyReservationForecastItems\([\s\S]*activeProperties[\s\S]*activeTasks/s, 'Building CRM service must reuse reservation forecast items');
assert.match(hooks, /buildingCrm: \(sedeId\?: string, propertyGroupId\?: string, dateFrom\?: string, dateTo\?: string\)/, 'React Query keys must include building CRM scope');
assert.match(hooks, /useOperationalPlanningBuildingCrm/, 'Hook must expose useOperationalPlanningBuildingCrm');
assert.match(appRoutes, /PlanningBuildingDetail/, 'App must lazy-load PlanningBuildingDetail');
assert.match(appRoutes, /path="\/planning\/buildings\/:propertyGroupId"[\s\S]*requiredModule="tasks" requiredAction="canEdit"[\s\S]*<PlanningBuildingDetail \/>/, 'Route /planning/buildings/:propertyGroupId must exist behind tasks/canEdit');

assert.match(page, /Ficha operativa del edificio/, 'CRM page must use plain operational wording');
assert.match(page, /30 días|60 días|90 días/, 'CRM page must expose simple forecast range presets');
assert.match(page, /BuildingCrmHeader/, 'CRM page must render header');
assert.match(page, /BuildingDemandCalendar/, 'CRM page must render demand calendar');
assert.match(page, /BuildingDecisionList/, 'CRM page must render decision list');
assert.match(header, /Estado operativo/, 'Header must answer operational status');
assert.match(header, /Planificar este edificio/, 'Header must expose planning CTA');
assert.match(header, /Editar configuración/, 'Header must link back to settings');
assert.match(kpis, /Horas servicio/, 'KPIs must separate service hours');
assert.match(kpis, /Horas-persona/, 'KPIs must separate person-hours');
assert.match(kpis, /Personal recomendado/, 'KPIs must show recommended staffing');
assert.match(calendar, /Confirmado/, 'Calendar must distinguish confirmed cleanings');
assert.match(calendar, /Previsto/, 'Calendar must distinguish forecast cleanings');
assert.match(calendar, /grid-cols-2 sm:grid-cols-3 lg:grid-cols-7/, 'Calendar must be responsive, not a wide table');
assert.match(decisions, /Decisiones del edificio/, 'Decision list must be explicit');
assert.match(decisions, /critical|warning|info/, 'Decision list must visually distinguish severities');
assert.match(team, /Titulares/, 'Team panel must group titulares');
assert.match(team, /Suplentes/, 'Team panel must group suplentes');
assert.match(team, /Backups/, 'Team panel must group backups');
assert.match(team, /No aptas/, 'Team panel must show No apta workers');
assert.match(properties, /Duración/, 'Properties panel must show duration');
assert.match(properties, /Necesita/, 'Properties panel must show required cleaners/personas');
assert.match(properties, /Editar propiedad/, 'Properties panel must provide a settings/edit link without inline editing');

assert.match(propertyGroupsPage, /\/planning\/buildings\/\$\{group\.id\}/, 'PropertyGroupsPage must link each group to building CRM');
assert.match(propertyGroupDetails, /\/planning\/buildings\/\$\{group\.id\}/, 'PropertyGroupDetails must link selected group to building CRM');
assert.match(planningTaskCard, /task\.detectedBuilding\?\.propertyGroupId/, 'Planning task cards must expose building CRM link when a building is detected');
assert.match(planningTaskCard, /Ver ficha edificio/, 'Planning task cards must use the requested building CRM wording');

console.log('planning-building-crm-ui-contract-tests: OK');
