import { ModuleRecordsView } from './ModuleRecordsView';

export function IntegrityModuleView({ tenant, onBack }: { tenant: { id: string }; user: unknown; onBack: () => void }) {
  return <ModuleRecordsView module="integrity" tenantId={tenant.id} onBack={onBack} />;
}
