-- 0004_auth_triggers.sql
-- When a new row is created in auth.users (any sign-up path: email,
-- anonymous, OAuth, etc.), automatically create a matching
-- public.users row. 

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _is_anon boolean;
begin
  _is_anon := coalesce(
    (new.raw_app_meta_data ->> 'provider') = 'anonymous',
    false
  );

  insert into public.users (id, email, is_anonymous)
  values (new.id, new.email, _is_anon)
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep email in sync if the auth.users email changes (e.g., after
-- email confirmation or update).
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.users
      set email = new.email,
          email_verification_time = extract(epoch from new.email_confirmed_at) * 1000
      where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.handle_user_email_change();
