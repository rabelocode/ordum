begin;

create table if not exists public.integrity_notification_preferences (
  membership_id uuid primary key references public.memberships(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false,
  cases_enabled boolean not null default true,
  messages_enabled boolean not null default true,
  tasks_enabled boolean not null default true,
  sla_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (tenant_id, membership_id)
);

create index if not exists integrity_notification_preferences_tenant_idx
  on public.integrity_notification_preferences(tenant_id, membership_id);

alter table public.integrity_notification_preferences enable row level security;

-- Preferências são mediadas pela API para combinar ator, membership e tenant.
-- A tabela permanece fail-closed para o Data API/browser.
revoke all on public.integrity_notification_preferences from public, anon, authenticated;
grant select, insert, update, delete on public.integrity_notification_preferences to service_role;

commit;
