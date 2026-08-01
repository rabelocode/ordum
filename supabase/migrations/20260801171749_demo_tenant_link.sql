alter table public.commercial_demos
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

create unique index if not exists commercial_demos_tenant_unique_idx
  on public.commercial_demos(tenant_id) where tenant_id is not null;
