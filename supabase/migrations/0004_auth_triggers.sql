-- 0004_auth_triggers.sql
--
-- Whenever a row is created in auth.users (any sign-up path: email,
-- anonymous, OAuth), automatically create a matching public.users row.
-- This is what keeps the two in sync without us having to do anything
-- on the client.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, is_anonymous)
  values (
    new.id,
    new.email,
    coalesce(new.is_anonymous, false)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep email + is_anonymous in sync if auth.users changes (e.g.,
-- email confirmation, or an anonymous user upgrading to email).
create or replace function public.handle_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
    set email = new.email,
        is_anonymous = coalesce(new.is_anonymous, false),
        email_verification_time = case
          when new.email_confirmed_at is not null
          then extract(epoch from new.email_confirmed_at) * 1000
          else email_verification_time
        end
    where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.handle_user_updated();
