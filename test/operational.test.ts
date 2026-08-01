import assert from 'node:assert/strict';
import test from 'node:test';
import { pageResult, parsePagination, withinManagerApprovalLimit } from '../src/server/operational';

test('server pagination clamps unsafe values and reports totals', () => {
  assert.deepEqual(parsePagination({ page: '-9', pageSize: '999' } as any), { page: 1, pageSize: 100, from: 0, to: 99 });
  assert.deepEqual(pageResult(['a'], 51, 3, 25).pagination, { page: 3, pageSize: 25, total: 51, totalPages: 3 });
});

test('manager approval requires an explicit non-negative team limit', () => {
  const team = { settings: { proposal_approval_limit_cents: 100_000, contract_approval_limit_cents: 80_000 } };
  assert.equal(withinManagerApprovalLimit(team, 100_000, 'proposal'), true);
  assert.equal(withinManagerApprovalLimit(team, 100_001, 'proposal'), false);
  assert.equal(withinManagerApprovalLimit({ settings: {} }, 1, 'contract'), false);
});
