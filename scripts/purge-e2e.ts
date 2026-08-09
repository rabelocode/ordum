import { createE2EAdminClient, purgeE2EResiduals } from './e2e-residuals.js';

purgeE2EResiduals(createE2EAdminClient())
  .then((counts) => console.log(`E2E_RESIDUES_AFTER=${JSON.stringify(counts)}`))
  .catch((error) => {
    console.error('E2E purge failed:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
