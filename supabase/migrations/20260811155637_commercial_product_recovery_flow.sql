-- Product Recovery 2: keep the commercial trail explicit without coupling it to billing.
alter table public.commercial_proposals
  add column if not exists sent_at timestamptz,
  add column if not exists sent_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists delivery_notes text;

alter table public.commercial_contracts
  add column if not exists external_signature_status text not null default 'not_sent'
    check (external_signature_status in ('not_sent','sent','signed')),
  add column if not exists external_signature_sent_at timestamptz,
  add column if not exists externally_signed_at timestamptz,
  add column if not exists external_signature_notes text,
  add column if not exists external_signature_actor_user_id uuid references auth.users(id) on delete set null;

comment on column public.commercial_contracts.external_signature_status is
  'Operational record only. It does not claim an electronic-signature provider integration.';
