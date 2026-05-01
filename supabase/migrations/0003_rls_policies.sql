-- 0003_rls_policies.sql
-- RLS is the Supabase equivalent of the `if (!userId) throw` checks
-- We enable it per-table and define granular policies. Without this, the anon key exposes everything in `public.*`.

alter table public.users enable row level security;

-- A user can always read their own full profile.
create policy "users_select_self"
  on public.users for select
  using (auth.uid() = id);

-- Any authenticated user can read other profiles. Tighten this to a
-- view with limited columns if you need to hide fields (e.g., email).
create policy "users_select_authed"
  on public.users for select
  using (auth.uid() is not null);

-- A user can only update their own row. WITH CHECK prevents them
-- changing the id field to someone else's on update.
create policy "users_update_self"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- A user can delete their own account (cascades from auth.users).
create policy "users_delete_self"
  on public.users for delete
  using (auth.uid() = id);

-- NOTE: No insert policy. Inserts happen via the trigger in 0004,
-- which runs as SECURITY DEFINER and bypasses RLS. This is
-- intentional — clients should never insert users directly.
