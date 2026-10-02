-- Run against a populated database after the subscription tier migration.
-- Copies one profile into a temporary table; never changes a real entitlement.
begin;
create temporary table entitlement_constraint_test
  (like public.profiles including constraints);
insert into entitlement_constraint_test select * from public.profiles limit 1;
do $$
begin
  if not exists (select 1 from entitlement_constraint_test) then
    raise exception 'Test requires at least one existing profile';
  end if;
end $$;
update entitlement_constraint_test set access_tier = 'pro';
update entitlement_constraint_test set access_tier = 'premium';
update entitlement_constraint_test set access_tier = 'free';
do $$
begin
  begin
    update entitlement_constraint_test set access_tier = 'invalid_tier';
    raise exception 'Invalid tier was accepted';
  exception when check_violation then
    null;
  end;
  if has_column_privilege('authenticated', 'public.profiles', 'access_tier', 'UPDATE')
    or has_column_privilege('authenticated', 'public.profiles', 'access_tier', 'INSERT') then
    raise exception 'Clients must not be able to grant themselves subscriptions';
  end if;
end $$;
rollback;
