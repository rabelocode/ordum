import { useEffect, useMemo, useState } from 'react';
import { derivePilotChecklist, type PilotChecklistItem } from '../../lib/pilotOnboarding';
import { supabase } from '../../lib/supabase';
import type { ModuleId } from '../../types';

export interface PilotOverview {
  loading: boolean;
  error: string | null;
  updatedAt: string | null;
  counts: Record<ModuleId, number | null>;
  checklist: PilotChecklistItem[];
  progress: number;
}

interface PilotOverviewState extends Omit<PilotOverview, 'checklist' | 'progress'> {
  memberCount: number | null;
}

async function countQuery(table: string, tenantId: string, configure?: (query: any) => any) {
  let query = (supabase as any).from(table).select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId);
  if (configure) query = configure(query);
  const { count, error } = await query;
  if (error) return null;
  return Number(count || 0);
}

export function usePilotOverview(input: { tenant: any; activeModules: ModuleId[]; permissions: string[]; roleCount: number }) {
  const [state, setState] = useState<PilotOverviewState>({
    loading: true,
    error: null,
    updatedAt: null,
    counts: { integrity: null, people: null, talent: null },
    memberCount: null,
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setState((current) => ({ ...current, loading: true, error: null }));
      try {
        const tenantId = input.tenant.id;
        const canReadIntegrity = input.permissions.some((key) => ['integrity.cases.read', 'integrity.cases.manage'].includes(key));
        const canReadPeople = input.permissions.some((key) => key.startsWith('people.'));
        const canReadTalent = input.permissions.some((key) => key.startsWith('talents.'));
        const [integrity, people, talent, members] = await Promise.all([
          canReadIntegrity ? countQuery('integrity_reports', tenantId, (query) => query.neq('status', 'closed')) : Promise.resolve(null),
          canReadPeople ? countQuery('people_requests', tenantId, (query) => query.neq('status', 'resolved')) : Promise.resolve(null),
          canReadTalent ? countQuery('talent_applications', tenantId, (query) => query.eq('status', 'active')) : Promise.resolve(null),
          countQuery('memberships', tenantId, (query) => query.eq('status', 'active')),
        ]);
        if (!cancelled) setState({ loading: false, error: null, updatedAt: new Date().toISOString(), counts: { integrity, people, talent }, memberCount: members });
      } catch {
        if (!cancelled) setState((current) => ({ ...current, loading: false, error: 'Não foi possível atualizar os indicadores do tenant.' }));
      }
    };
    load();
    return () => { cancelled = true; };
  }, [input.tenant.id, input.permissions.join('|'), input.activeModules.join('|')]);

  return useMemo<PilotOverview>(() => {
    const firstActionCount = (Object.values(state.counts) as Array<number | null>).reduce<number>((sum, value) => sum + (value ?? 0), 0);
    const checklist = derivePilotChecklist({
      activeModuleCount: input.activeModules.length,
      companyConfigured: Boolean(input.tenant.name && input.tenant.slug),
      firstActionCount,
      memberCount: state.memberCount,
      roleCount: input.roleCount,
    });
    const progress = Math.round(100 * checklist.filter((item) => item.complete).length / checklist.length);
    return { ...state, checklist, progress };
  }, [state, input.activeModules.length, input.roleCount, input.tenant.name, input.tenant.slug]);
}
