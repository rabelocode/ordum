import { ModuleRecordsView } from './ModuleRecordsView';

export function TalentModuleView({ tenant, onBack }: { tenant: { id: string }; user: unknown; onBack: () => void }) {
  return <ModuleRecordsView module="talent" tenantId={tenant.id} onBack={onBack} />;
}
