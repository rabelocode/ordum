-- Phase 4G: keep routing collaborators inside the rule tenant even for direct PostgREST writes.
drop policy if exists integrity_routing_collaborators_manage on public.integrity_routing_rule_collaborators;

create policy integrity_routing_collaborators_manage
on public.integrity_routing_rule_collaborators
for all
to authenticated
using (
  public.has_permission(tenant_id, 'integrity.settings.manage')
  and exists (
    select 1
    from public.integrity_routing_rules rule
    where rule.id = integrity_routing_rule_collaborators.rule_id
      and rule.tenant_id = integrity_routing_rule_collaborators.tenant_id
  )
  and exists (
    select 1
    from public.memberships member
    where member.id = integrity_routing_rule_collaborators.membership_id
      and member.tenant_id = integrity_routing_rule_collaborators.tenant_id
      and member.status = 'active'
  )
)
with check (
  public.has_permission(tenant_id, 'integrity.settings.manage')
  and exists (
    select 1
    from public.integrity_routing_rules rule
    where rule.id = integrity_routing_rule_collaborators.rule_id
      and rule.tenant_id = integrity_routing_rule_collaborators.tenant_id
  )
  and exists (
    select 1
    from public.memberships member
    where member.id = integrity_routing_rule_collaborators.membership_id
      and member.tenant_id = integrity_routing_rule_collaborators.tenant_id
      and member.status = 'active'
  )
);
