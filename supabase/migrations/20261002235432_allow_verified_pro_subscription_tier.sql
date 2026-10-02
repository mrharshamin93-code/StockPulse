-- StoreKit verification and server-side entitlement checks use `pro`.
-- Preserve the legacy premium tier without granting it StoreKit access.
alter table public.profiles
  drop constraint if exists profiles_access_tier_check;

alter table public.profiles
  add constraint profiles_access_tier_check
  check (access_tier in ('free', 'premium', 'pro'));
