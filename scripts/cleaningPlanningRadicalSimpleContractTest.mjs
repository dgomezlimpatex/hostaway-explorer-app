import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');
const startPath = 'src/components/cleaning-planning/PlanningStartScreen.tsx';

assert.ok(existsSync(join(root, startPath)), 'the radical-simple planning start screen must exist');

const start = read(startPath);
const page = read('src/components/cleaning-planning/CleaningPlanningPage.tsx');
const proposal = read('src/components/cleaning-planning/AssignmentProposalPanel.tsx');
const calendar = read('src/components/cleaning-planning/PlanningProposalCalendar.tsx');

const visiblePrimaryControls = start.match(/data-planning-initial-control/g) || [];
assert.ok(visiblePrimaryControls.length > 0, 'initial controls must be explicitly measurable in code');
assert.ok(visiblePrimaryControls.length <= 5, `initial screen has ${visiblePrimaryControls.length} visible controls; maximum is 5`);

assert.match(page, /addDays\(getTodayMadrid\(\), 1\)/, 'tomorrow must be the intelligent default');
assert.match(page, /proposalState\s*\?\s*\(/, 'proposal review must replace the initial cockpit instead of stacking below it');
assert.match(start, /Preparar reparto con Hermes/, 'the start screen must explain that Hermes prepares a reviewable draft');
assert.match(start, /Opciones avanzadas/, 'non-daily functions must require explicit disclosure');
assert.match(start, /Alcance parcial/, 'active filters must never look like the whole day was planned');
assert.doesNotMatch(start, /PlanningWorkflowGuide|PlanningAttentionSummary|PlanningDecisionQueue/, 'the default start screen must not render competing panels');

assert.match(proposal, /Guardar reparto y avisar/, 'the review must expose the final one-step save action');
assert.match(proposal, /Alcance parcial/, 'proposal review must preserve partial-scope context');
assert.match(proposal, /Descartar propuesta/, 'the sandbox must expose an explicit reject/discard action');
assert.doesNotMatch(proposal, /AlertDialog|Confirmar y guardar|Revisar y confirmar/, 'approval must not add a redundant confirmation modal');
assert.match(proposal, /applyInFlightRef/, 'approval must have an immediate single-flight guard against double click');
assert.match(proposal, /Sin cubrir/, 'red/uncovered work must be impossible to miss');
assert.match(proposal, /(?:sticky|fixed)/, 'approval and red status must remain visible without a second structural scroll');
assert.match(proposal, /sessionStorage|localStorage/, 'sandbox edits must autosave in background outside production data');

assert.match(page, /freshTasksResult\.isError/, 'a failed pre-apply refetch must block the write instead of accepting cached data');
assert.match(page, /if\s*\(freshTasksResult\.isError\s*\|\|\s*!freshTasksResult\.data\)/, 'fresh-data failure or absence must have an explicit early guard');
assert.match(proposal, /completeDraftProposals/, 'partial approval must build its payload from complete tasks only');
assert.match(proposal, /coveredTaskIds\.has\(item\.taskId\)/, 'every person in an incomplete multi-cleaner task must be excluded from apply');
assert.match(proposal, /draftSafetyReady/, 'restored or edited drafts must wait for fresh UI safety checks');
assert.match(proposal, /handleDraftProposalsChange/, 'every draft edit must invalidate the previous safety calculation');
assert.match(proposal, /handleDraftWarningsChange/, 'approval must re-enable only after warnings are recalculated');
assert.match(proposal, /onApply\(completeDraftProposals\)/, 'the apply handler must submit only complete task groups');

assert.doesNotMatch(calendar, /unassignedTasks\.slice\(/, 'every uncovered task must remain reachable; the red list cannot be silently truncated');
assert.match(calendar, /onClick=.*openReassignment|openReassignment.*onClick/s, 'tapping a task must open reassignment');
assert.match(calendar, /Elegir responsable/, 'the second interaction must be choosing a valid candidate');
assert.doesNotMatch(calendar, /:\s*'Disponible';/, 'the picker must not claim full availability before safety warnings are recalculated');
assert.match(calendar, /assignmentRole/, 'traffic-light status must come from the real proposal role');
assert.match(calendar, /handleCleanerChange\(reassignment\.proposalIndex, cleanerId, assignmentRole\)/, 'reassigning a draft position must refresh its real building-team role');
assert.match(calendar, /Sin cubrir/, 'uncovered tasks must render as explicit red cards');
assert.doesNotMatch(calendar, /taskStorageService|multipleTaskAssignmentService|supabase\.from/, 'sandbox editing must remain local until approval');

console.log(`cleaning-planning-radical-simple-contract-tests: OK (${visiblePrimaryControls.length} initial controls)`);
