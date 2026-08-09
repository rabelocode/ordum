-- Cover foreign keys used by Phase 4B authorization, routing and evidence cleanup.
create index if not exists integrity_attachments_file_idx
  on public.integrity_attachments(file_id);
create index if not exists integrity_attachments_deleted_by_idx
  on public.integrity_attachments(deleted_by_membership_id)
  where deleted_by_membership_id is not null;

create index if not exists integrity_tasks_assignee_idx
  on public.integrity_case_tasks(assignee_membership_id)
  where assignee_membership_id is not null;
create index if not exists integrity_tasks_created_by_idx
  on public.integrity_case_tasks(created_by_membership_id);
create index if not exists integrity_tasks_completed_by_idx
  on public.integrity_case_tasks(completed_by_membership_id)
  where completed_by_membership_id is not null;

create index if not exists integrity_cases_committee_idx
  on public.integrity_cases(committee_id)
  where committee_id is not null;
create index if not exists integrity_cases_decided_by_idx
  on public.integrity_cases(decided_by_membership_id)
  where decided_by_membership_id is not null;

create index if not exists integrity_committee_members_membership_idx
  on public.integrity_committee_members(membership_id);
create index if not exists integrity_routing_category_idx
  on public.integrity_routing_rules(category_id)
  where category_id is not null;
create index if not exists integrity_routing_unit_idx
  on public.integrity_routing_rules(unit_id)
  where unit_id is not null;
create index if not exists integrity_routing_assignee_idx
  on public.integrity_routing_rules(assignee_membership_id)
  where assignee_membership_id is not null;
create index if not exists integrity_routing_committee_idx
  on public.integrity_routing_rules(committee_id)
  where committee_id is not null;

create index if not exists integrity_settings_default_assignee_idx
  on public.integrity_settings(default_assignee_membership_id)
  where default_assignee_membership_id is not null;
create index if not exists integrity_settings_default_committee_idx
  on public.integrity_settings(default_committee_id)
  where default_committee_id is not null;
