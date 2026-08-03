import { ModuleRecordsView } from './ModuleRecordsView';

export function PeopleModuleView({ tenant, onBack }: { tenant: { id: string }; user: unknown; onBack: () => void }) {
  return <ModuleRecordsView module="people" tenantId={tenant.id} onBack={onBack} />;
}
