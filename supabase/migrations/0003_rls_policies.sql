-- 0003_rls_policies.sql
--
-- RLS is the Supabase equivalent of Convex's `if (!userId) throw` checks.
-- The anon key is shipped to every client, so without RLS every public.*
-- table is wide open. Enable it per-table and write granular policies.
--
-- Anonymous users (created by signInAnonymously) DO assume the
-- `authenticated` Postgres role — they're not the same as the `anon`
-- role. To distinguish them we check the JWT claim `is_anonymous`.
-- We use restrictive helpers below to make that intent explicit.

alter table public.users enable row level security;

-- Always select with the role specified (`to authenticated`) — Supabase's
-- own perf guide recommends this so the policy isn't even considered for
-- the `anon` role.

-- A user can always read their own full profile (works for anon too).
create policy "users_select_self"
  on public.users for select
  to authenticated
  using ((select auth.uid()) = id);

-- Any *permanent* user can read other profiles. Anonymous users are
-- limited to seeing themselves. The is_anonymous claim is a JWT claim
-- the user can't forge.
create policy "users_select_others_when_permanent"
  on public.users for select
  to authenticated
  using (
    coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    and (select auth.uid()) is not null
  );

-- A user can only update their own row. WITH CHECK prevents them
-- changing the id field to someone else's on update.
create policy "users_update_self"
  on public.users for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- A user can delete their own account (cascades from auth.users).
create policy "users_delete_self"
  on public.users for delete
  to authenticated
  using ((select auth.uid()) = id);

-- NOTE: No insert policy. Inserts happen via the trigger in 0004,
-- which runs as SECURITY DEFINER and bypasses RLS. Clients should
-- never insert into public.users directly — sign up via auth.
