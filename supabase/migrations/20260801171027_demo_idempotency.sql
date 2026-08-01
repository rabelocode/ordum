-- A lead has at most one demo lifecycle; retries update the same record.
create unique index if not exists commercial_demos_lead_unique_idx
  on public.commercial_demos(lead_id);
