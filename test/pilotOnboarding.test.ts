import test from 'node:test';
import assert from 'node:assert/strict';
import { derivePilotChecklist } from '../src/lib/pilotOnboarding';

test('pilot checklist never invents completion without operational evidence', () => {
  const checklist = derivePilotChecklist({
    activeModuleCount: 0,
    companyConfigured: false,
    firstActionCount: 0,
    memberCount: 1,
    roleCount: 0,
  });
  assert.equal(checklist.every((item) => !item.complete), true);
});

test('pilot checklist derives completion from scoped tenant facts', () => {
  const checklist = derivePilotChecklist({
    activeModuleCount: 3,
    companyConfigured: true,
    firstActionCount: 1,
    memberCount: 2,
    roleCount: 1,
  });
  assert.equal(checklist.every((item) => item.complete), true);
});
