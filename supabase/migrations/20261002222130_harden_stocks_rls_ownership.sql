drop policy if exists "users can view own stocks" on public.stocks;
drop policy if exists "users can insert own stocks" on public.stocks;
drop policy if exists "users can update own stocks" on public.stocks;
drop policy if exists "users can delete own stocks" on public.stocks;
drop policy if exists "Admins can manage stocks" on public.stocks;

create policy "users can view own stocks"
on public.stocks
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "users can insert own stocks"
on public.stocks
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "users can update own stocks"
on public.stocks
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users can delete own stocks"
on public.stocks
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Admins can manage stocks"
on public.stocks
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
);
