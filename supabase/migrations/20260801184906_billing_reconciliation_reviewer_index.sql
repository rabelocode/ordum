create index if not exists billing_reconciliation_items_reviewer_idx
  on public.billing_reconciliation_items(reviewed_by_user_id)
  where reviewed_by_user_id is not null;
