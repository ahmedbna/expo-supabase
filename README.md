# BNA Supabase Starter

A production-ready Expo React Native + Supabase starter with a **code-first, no-Docker** workflow.

Edit a SQL file or `config.toml` locally → save → it's live in your hosted Supabase project. Database schema, RLS policies, auth triggers, anonymous sign-ins, and OAuth providers are all defined in this repo and synced to the cloud automatically. **You never touch the Supabase dashboard.**

If you've used Convex, this maps almost 1:1:

| Convex                     | This template                       |
| -------------------------- | ----------------------------------- |
| `npx convex dev`           | `npm run dev`                       |
| `convex/schema.ts`         | `supabase/migrations/*.sql`         |
| `convex/functions/*.ts`    | `supabase/api/*.ts`                 |
| `_generated/api.d.ts`      | `supabase/types.ts` (auto-regen)    |
| Auth dashboard             | `supabase/config.toml` (pushed live)|

> **No Docker needed.** Everything runs against your hosted Supabase project. There's no local Postgres to start, stop, or sync to. This is a deliberate choice — same model as Convex.

---

## Quick start

### Prerequisites

- Node 20+
- A free Supabase account (sign up at <https://supabase.com>)

That's it. **No Docker, no `psql`, no global CLI install.** The Supabase CLI runs via `npx` from `devDependencies`.

### 1. Clone + install

```bash
git clone <your-fork>
cd bna-supabase
npm install
```

### 2. One-time bootstrap

```bash
npm run init
```

This walks you through:

1. Logging into the Supabase CLI (opens your browser)
2. Picking an existing project, **or creating one for you**
3. Linking this folder to it
4. Writing your URL/anon key/project ref into `.env.local` automatically
5. Pushing all migrations in `supabase/migrations/` to the hosted DB
6. Pushing `supabase/config.toml` (so anonymous sign-ins, signup rules, etc. become live on your project)
7. Generating `supabase/types.ts` from the live schema

When it's done, your hosted project has the `users` table, RLS policies, auth triggers, and anonymous sign-ins all configured. **You will not have clicked anything in the dashboard.**

### 3. Live dev loop

In one terminal:

```bash
npm run dev
```

This watches `supabase/migrations/` and `supabase/config.toml`. Any save automatically:

- Runs the **RLS guard** (refuses to push schema if a `public.*` table has no RLS)
- Pushes new migrations to your hosted DB
- Regenerates `supabase/types.ts` from the new live schema
- Pushes `config.toml` changes (auth providers, rate limits, etc.)

Leave it running while you code.

### 4. Run the app

In another terminal:

```bash
npm run ios       # or: npm run android
```

You'll see a login screen with **Sign In**, **Sign Up**, and **Continue as Guest** (anonymous). All three work out of the box because of what you pushed in step 2.

---

## How anonymous auth works in this template

Anonymous sign-ins are enabled in `supabase/config.toml`:

```toml
[auth]
enable_anonymous_sign_ins = true
enable_manual_linking = true   # required to upgrade anon → permanent
```

The `Continue as Guest` button calls `api.auth.signInAnonymously()`, which creates a real `auth.users` row with `is_anonymous = true`. The trigger in migration `0004` automatically creates the matching `public.users` profile.

Anonymous users **assume the `authenticated` role** — they're not the same as the `anon` Postgres role. The RLS policies in migration `0003` distinguish them by checking the JWT claim:

```sql
-- Permanent users only:
create policy "..."
  on public.posts for select to authenticated
  using (
    coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

-- Anonymous OR permanent (anyone signed in):
create policy "..."
  on public.posts for select to authenticated
  using ((select auth.uid()) is not null);
```

When an anonymous user wants to convert to a permanent account without losing their data, drop in `<UpgradeAccount />` from `components/auth/upgrade-account.tsx`. It walks them through email verification + password set, keeping the same `auth.uid` and all their existing rows. The api methods are `api.auth.upgradeAnonymousToEmail(email)` and `api.auth.setPasswordForUpgradedUser(password)`.

---

## Adding a new feature — e.g., a `posts` table

### 1. Scaffold a migration

```bash
npm run db:new add_posts_table
```

Creates `supabase/migrations/0005_add_posts_table.sql` with a template.

### 2. Write the SQL

```sql
-- supabase/migrations/0005_add_posts_table.sql
create table public.posts (
  id          uuid primary key default extensions.uuid_generate_v4(),
  author_id   uuid not null references public.users(id) on delete cascade,
  content     text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.posts enable row level security;

-- Read: any signed-in user (including anonymous).
create policy "posts_select_authed"
  on public.posts for select to authenticated
  using ((select auth.uid()) is not null);

-- Insert: only as yourself, and only if you're a permanent user
-- (don't let anonymous users post). Tighten or relax as needed.
create policy "posts_insert_own_permanent"
  on public.posts for insert to authenticated
  with check (
    (select auth.uid()) = author_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

create policy "posts_update_own"
  on public.posts for update to authenticated
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);

create policy "posts_delete_own"
  on public.posts for delete to authenticated
  using ((select auth.uid()) = author_id);

create trigger posts_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();
```

Save the file. `npm run dev` notices, runs the RLS guard, pushes to your hosted DB, regenerates types. Your TypeScript `Database['public']['Tables']['posts']` type now exists.

### 3. Add the api module

```ts
// supabase/api/posts.ts
import { supabase } from '@/supabase/client';
import { requireUserId, ApiError } from './_helpers';
import type { Database } from '@/supabase/types';

export type Post = Database['public']['Tables']['posts']['Row'];

export const posts = {
  async list(): Promise<Post[]> {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new ApiError(error.message, error.code, error);
    return data ?? [];
  },
  async create(content: string) {
    const authorId = await requireUserId();
    const { error } = await supabase
      .from('posts')
      .insert({ author_id: authorId, content });
    if (error) throw new ApiError(error.message, error.code, error);
  },
};
```

### 4. Expose it

```ts
// supabase/api/index.ts
import { users } from './users';
import { auth } from './auth';
import { posts } from './posts';

export const api = { users, auth, posts };
```

### 5. Use it from a screen

```tsx
const { data: posts } = useQuery({
  queryKey: ['posts'],
  queryFn: api.posts.list,
});

const create = useMutation({
  mutationFn: api.posts.create,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posts'] }),
});
```

That's it — no manual deploy step. The dev loop already pushed your schema when you saved the SQL file.

---

## Project structure

```
bna-supabase/
├── scripts/
│   ├── init.js             # `npm run init`   — first-run bootstrap
│   ├── dev.js              # `npm run dev`    — watch + auto-push
│   ├── new-migration.js    # `npm run db:new` — scaffold 0005_thing.sql
│   ├── gen-types.js        # `npm run db:types` — regen from remote
│   └── check-rls.js        # RLS guard (static SQL parse)
│
├── src/
│   ├── app/                # Expo Router screens
│   ├── components/auth/
│   │   ├── authentication.tsx
│   │   ├── singout.tsx
│   │   └── upgrade-account.tsx   # anon → permanent flow
│   ├── components/ui/
│   ├── hooks/
│   └── theme/
│
├── supabase/               # ← The "convex/" equivalent
│   ├── client.ts           # ONLY place createClient is called
│   ├── types.ts            # Generated — do not edit
│   ├── config.toml         # AUTH config — pushed to hosted project
│   ├── api/                # Business logic (Convex-style)
│   │   ├── _helpers.ts
│   │   ├── auth.ts         # signIn, signUp, anonymous, upgrade
│   │   ├── users.ts
│   │   └── index.ts
│   └── migrations/         # Numbered, append-only SQL
│       ├── 0001_init.sql
│       ├── 0002_users_table.sql
│       ├── 0003_rls_policies.sql
│       └── 0004_auth_triggers.sql
│
├── .env.example
└── package.json
```

---

## Architecture rules (don't break these)

### 1. UI never imports `supabase/client.ts` directly

Always import from `@/supabase/api`. This single rule is what makes refactors painless.

### 2. Migrations are append-only

Once a migration has been pushed (which `npm run dev` does on save), it's frozen. **Never edit it.** Add a new migration that fixes whatever needs fixing.

### 3. Never edit your DB through the Supabase dashboard

If you create a table or change a column via the dashboard's SQL editor or Table Editor, you bypass the migration history. The next `db push` will fail with sync errors. Treat the dashboard as **read-only** — your migration files are the source of truth.

If someone else changes the remote DB outside of your migrations, recover with:

```bash
npx supabase db pull   # captures the drift as a new migration
```

Review the pulled file, commit it, move on.

### 4. Every public table has RLS enabled

The anon key ships with your app. A single un-RLSed table is a public data leak. The dev loop runs a static check on your migrations and refuses to push if any `public.*` table is missing `enable row level security`.

### 5. API functions throw on error, never return `{ data, error }`

Screens use `try/catch` or TanStack Query's `error` state.

---

## Daily commands

| What you want to do                       | Command                  |
| ----------------------------------------- | ------------------------ |
| First-time setup                          | `npm run init`           |
| Live dev loop (watch + auto-push)         | `npm run dev`            |
| Add a new migration                       | `npm run db:new <name>`  |
| Regenerate types (one-shot)               | `npm run db:types`       |
| Push schema manually                      | `npm run db:push`        |
| Push config (auth, providers) manually    | `npm run config:push`    |
| Run the app                               | `npm run ios` / `android`|

---

## Going to production

This template treats "dev" and "prod" as **two separate Supabase projects** (free tier each). The recommended flow:

1. **Run `npm run init` once** to create a "dev" project. Use it freely while developing.

2. **Create a second project** for production. The simplest approach:

   ```bash
   # Create a fresh checkout linked to a new project
   git clone <repo> bna-prod
   cd bna-prod
   npm install
   npm run init   # pick or create your prod project
   ```

3. **In CI / EAS build secrets**, set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` to your prod project's values.

4. **For ongoing prod releases**, run `npm run db:push` and `npm run config:push` from the prod-linked checkout (or wire it up in CI using the env vars `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID`).

> **Why two checkouts?** Because each one's `.env.local` and `supabase/.temp/project-ref` is tied to a single project. You could also use one checkout and re-run `init` when switching, but separate folders make accidents impossible.

---

## Adding OAuth providers (still no dashboard)

Edit `supabase/config.toml`:

```toml
[auth.external.google]
enabled = true
client_id = "env(GOOGLE_CLIENT_ID)"
secret    = "env(GOOGLE_CLIENT_SECRET)"
redirect_uri = "https://<your-ref>.supabase.co/auth/v1/callback"
```

Add the secrets to `.env.local`:

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Save. The dev loop will push the change. Provider is now live on your hosted project.

---

## Troubleshooting

**`Run npm run init` error from `npm run dev`** — your `.env.local` is missing the project ref or DB password. Run `npm run init`.

**`db push` fails with sync errors** — someone (you?) edited the remote DB outside of migrations. Run `npx supabase db pull` to capture the drift as a new migration, review, commit, then continue.

**Anonymous sign-in returns "Anonymous sign-ins are disabled"** — your config push didn't take. Check `supabase/config.toml` has `enable_anonymous_sign_ins = true` under `[auth]`, save it (or run `npm run config:push`), and try again.

**Types out of date** — `npm run db:types` regenerates from the live remote schema.

**Want to reset everything** — delete the project from <https://supabase.com/dashboard>, delete `supabase/.temp/`, delete `.env.local`, run `npm run init` again.

---

## License

MIT — use this however you like.
