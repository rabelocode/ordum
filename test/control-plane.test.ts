import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanUuidList, csvCell, intersectAllowed } from '../src/server/adminControlPlaneRouter';

const ONE = '11111111-1111-4111-8111-111111111111';
const TWO = '22222222-2222-4222-8222-222222222222';

test('control-plane filters accept only bounded UUID lists', () => {
  assert.deepEqual(cleanUuidList(`${ONE},invalid,${ONE},${TWO}`), [ONE, TWO]);
  assert.equal(cleanUuidList('invalid'), null);
  assert.equal(cleanUuidList(undefined), null);
});

test('scope intersection never expands the caller authorization', () => {
  assert.deepEqual(intersectAllowed([ONE, TWO], [ONE]), [ONE]);
  assert.deepEqual(intersectAllowed(null, [ONE]), [ONE]);
  assert.deepEqual(intersectAllowed([TWO], [ONE]), []);
  assert.deepEqual(intersectAllowed([ONE], null), [ONE]);
});

test('CSV export neutralizes line breaks and quotes values', () => {
  assert.equal(csvCell('=cmd\r\n"quoted"'), '"\'=cmd ""quoted"""');
  assert.equal(csvCell({ safe: true }), '"{""safe"":true}"');
});
