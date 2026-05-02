-- 0002_users_table.sql
-- Linked 1:1 to auth.users. Every authenticated user (permanent OR
-- anonymous) gets a matching row here, kept in sync by the triggers
-- in 0004.

create table public.users (
  id                        uuid primary key references auth.users(id) on delete cascade,
  email                     text unique,
  phone                     text unique,
  name                      text,
  bio                       text,
  gender                    text,
  birthday                  bigint,                 -- ms epoch
  image                     text,
  email_verification_time   double precision,
  phone_verification_time   double precision,
  is_anonymous              boolean not null default false,
  github_id                 bigint,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index users_phone_idx on public.users (phone);

create trigger users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();
