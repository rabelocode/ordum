begin;

create index if not exists integrity_collaborators_tenant_idx on public.integrity_case_collaborators(tenant_id);
create index if not exists integrity_collaborators_added_by_idx on public.integrity_case_collaborators(added_by_membership_id);
create index if not exists integrity_collaborators_removed_by_idx on public.integrity_case_collaborators(removed_by_membership_id) where removed_by_membership_id is not null;
create index if not exists integrity_notifications_event_idx on public.integrity_notifications(event_id) where event_id is not null;
create index if not exists integrity_notifications_tenant_recipient_idx on public.integrity_notifications(tenant_id,recipient_membership_id,created_at desc);
create index if not exists integrity_templates_created_by_idx on public.integrity_templates(created_by_membership_id);
create index if not exists integrity_templates_updated_by_idx on public.integrity_templates(updated_by_membership_id) where updated_by_membership_id is not null;

drop policy if exists integrity_collaborators_manage on public.integrity_case_collaborators;
create policy integrity_collaborators_insert on public.integrity_case_collaborators for insert to authenticated
with check (
  private.can_access_integrity_case(case_id)
  and public.has_permission(tenant_id,'integrity.investigators.manage')
  and exists(select 1 from public.integrity_cases c where c.id=case_id and c.tenant_id=tenant_id)
  and exists(select 1 from public.memberships m where m.id=membership_id and m.tenant_id=tenant_id and m.status='active')
);
create policy integrity_collaborators_update on public.integrity_case_collaborators for update to authenticated
using (
  private.can_access_integrity_case(case_id)
  and public.has_permission(tenant_id,'integrity.investigators.manage')
)
with check (
  private.can_access_integrity_case(case_id)
  and public.has_permission(tenant_id,'integrity.investigators.manage')
  and exists(select 1 from public.integrity_cases c where c.id=case_id and c.tenant_id=tenant_id)
  and exists(select 1 from public.memberships m where m.id=membership_id and m.tenant_id=tenant_id and m.status='active')
);
create policy integrity_collaborators_delete on public.integrity_case_collaborators for delete to authenticated
using (
  private.can_access_integrity_case(case_id)
  and public.has_permission(tenant_id,'integrity.investigators.manage')
);

drop policy if exists integrity_templates_manage on public.integrity_templates;
create policy integrity_templates_insert on public.integrity_templates for insert to authenticated
with check (public.has_permission(tenant_id,'integrity.templates.manage'));
create policy integrity_templates_update on public.integrity_templates for update to authenticated
using (public.has_permission(tenant_id,'integrity.templates.manage'))
with check (public.has_permission(tenant_id,'integrity.templates.manage'));
create policy integrity_templates_delete on public.integrity_templates for delete to authenticated
using (public.has_permission(tenant_id,'integrity.templates.manage'));

commit;
