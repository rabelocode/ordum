import { createE2EAdminClient, inspectE2EResiduals, purgeE2EResiduals } from './e2e-residuals.js';

async function main() {
  const db = createE2EAdminClient();
  const before = await inspectE2EResiduals(db);
  console.log(`E2E_RESIDUES_BEFORE=${JSON.stringify(before)}`);
  const after = await purgeE2EResiduals(db);
  console.log(`E2E_RESIDUES_AFTER=${JSON.stringify(after)}`);
}

main().catch((error) => {
  console.error('E2E residual cleanup failed:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
