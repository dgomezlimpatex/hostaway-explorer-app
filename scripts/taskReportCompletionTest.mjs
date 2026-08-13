import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const modal = readFileSync(join(root, 'src/components/modals/TaskReportModal.tsx'), 'utf8');
const tabs = readFileSync(join(root, 'src/components/modals/task-report/TaskReportTabs.tsx'), 'utf8');
const sequential = readFileSync(join(root, 'src/components/modals/task-report/SequentialTaskReport.tsx'), 'utf8');

// Desktop regression: the visible Summary tab must update the logical workflow step.
assert.match(
  tabs,
  /const handleTabChange\s*=\s*\(tab:\s*string\)\s*=>\s*\{[\s\S]*onTabChange\(tab\)[\s\S]*onStepChange\(tab === 'summary' \? 'summary' : 'checklist'\)/,
  'Desktop tab changes must keep activeTab and currentStep synchronized',
);

// The auto-advance path must also keep the desktop tab in Summary.
assert.match(
  modal,
  /setCurrentStep\('summary'\)[\s\S]*setActiveTab\('summary'\)/,
  'Automatic transition to Summary must update both workflow states',
);

// Mobile regression: optional checklist items must not block the next step.
assert.match(
  sequential,
  /requiredValidationIsValid:\s*boolean/,
  'Sequential mobile flow must receive the mandatory validation result',
);
assert.match(
  sequential,
  /case 'checklist':\s*\n\s*return requiredValidationIsValid;/,
  'Mobile progression must use required-item/photo validation',
);
assert.match(
  sequential,
  /!requiredValidationIsValid\s*&&/,
  'Mobile summary warning must reflect mandatory validation, not optional items',
);

console.log('Task report completion regression contract passed');
