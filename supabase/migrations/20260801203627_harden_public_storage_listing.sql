-- Public object URLs for a public bucket do not require a SELECT policy.
-- Removing this policy prevents anonymous/authenticated clients from listing
-- every object through the Storage API while preserving public URL delivery.
drop policy if exists storage_public_read on storage.objects;
