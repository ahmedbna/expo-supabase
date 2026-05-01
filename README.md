# BNA Supabase Starter

Production-ready Expo React Native + Supabase starter template with a code-first backend philosophy. Database schema, auth, RLS policies, and business logic all live in version-controlled code — no dashboard clicking required.

This is the Supabase port of the BNA Convex starter, structured so that moving screens between backends is a minimal-diff operation.

## What's Inside

- **Expo 55 + React Router v6** — latest SDK with the new architecture enabled
- **Supabase** — Postgres + Auth + Realtime, all managed via SQL migrations
- **TanStack Query** — reactivity layer (Supabase equivalent of Convex auto-queries)
- **TypeScript end-to-end** — generated DB types flow through the api layer into components
- **Row Level Security** — enabled on every table, with a `db:check-rls` guard
- **SecureStore-backed sessions** — tokens persist across app restarts, auto-refresh on foreground
- **Themed UI** — light/dark/system toggle with animated components (button, spinner, form fields)
- **Haptic feedback, keyboard-aware forms, animated inputs** — production polish out of the box

## Quickstart

### 1. Prerequisites

- Node 20+
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started): `brew install supabase/tap/supabase` (or npm install)
- Expo dev build on your phone / simulator

### 2. Install

```bash
npm install
cp .env.example .env.local
```

### 3. Start local Supabase

```bash
npm run db:start
```

This boots Postgres, GoTrue (auth), Realtime, Storage, and Studio locally. When it finishes, copy the printed `anon key` and `service_role key` into `.env.local`:

```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_KEY=<paste anon key>
SUPABASE_SERVICE_ROLE_KEY=<paste service role key>
SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

> On a physical device, replace `127.0.0.1` with your machine's LAN IP (e.g., `192.168.1.x`) so the phone can reach Supabase.

### 4. Apply migrations & generate types

```bash
npm run db:reset    # apply all migrations and run seed
npm run db:types    # generate supabase/types.ts from the live schema
```

### 5. Run the app

```bash
npm run ios      # or: npm run android
```

Sign up with any email + password meeting the policy (8+ chars, upper, lower, digit). The trigger in migration 0004 will auto-create a `public.users` row. Open Studio at `http://127.0.0.1:54323` to verify.

## Project Structure

```
bna-supabase/
├── app/                          # Expo Router screens
│   ├── (home)/                   # Tab navigator
│   │   ├── _layout.tsx
│   │   ├── index.tsx             # Home screen
│   │   └── settings.tsx          # Uses api.auth.loggedInUser via TanStack Query
│   ├── _layout.tsx               # Providers: Auth, QueryClient, Theme
│   ├── +not-found.tsx
│   └── index.tsx                 # Redirect to (home)
│
├── components/
│   ├── auth/
│   │   ├── authentication.tsx    # Email + password + guest sign-in form
│   │   └── singout.tsx
│   └── ui/
│       ├── button.tsx            # Animated Pressable with haptics
│       └── spinner.tsx           # Rotating Loader2 icon
│
├── hooks/
│   ├── useAuth.tsx               # Auth context + provider (replaces ConvexAuthProvider)
│   ├── useColor.ts               # Theme color resolver
│   └── useModeToggle.tsx         # Light/dark/system toggle
│
├── theme/
│   ├── colors.ts
│   └── theme-provider.tsx
│
├── supabase/                     # ← The "convex/" equivalent
│   ├── client.ts                 # ONLY place createClient is called
│   ├── types.ts                  # Generated from schema — do not edit
│   ├── config.toml               # Local Supabase config (committed)
│   ├── seed.sql                  # Local dev seed data
│   ├── api/                      # Business logic, Convex-style
│   │   ├── _helpers.ts           # requireUserId, ApiError, unwrap
│   │   ├── auth.ts               # signIn, signUp, signOut, loggedInUser
│   │   ├── users.ts              # get, getByEmail, getAll, update, subscribeToSelf
│   │   └── index.ts              # export const api = { users, auth }
│   └── migrations/               # Numbered, append-only SQL files
│       ├── 0001_init.sql
│       ├── 0002_users_table.sql
│       ├── 0003_rls_policies.sql
│       └── 0004_auth_triggers.sql
│
├── scripts/
│   ├── check-rls.js              # Fails if any public table has RLS off
│   └── gen-types.js              # Wrapper around `supabase gen types`
│
├── .env.example
├── app.json
├── package.json
└── tsconfig.json
```

## The Architecture Rules

These are the constraints that keep the code-first philosophy intact as the app grows.

### 1. Never import `supabase/client.ts` outside `supabase/api/`

UI code imports from `@/supabase/api` — never the raw client. This is the single most important rule. It means refactoring (e.g., swapping to a new backend, adding caching, instrumenting calls) happens in one place.

```ts
// Bad
import { supabase } from '@/supabase/client';
const { data } = await supabase.from('users').select('*');

// Good
import { api } from '@/supabase/api';
const users = await api.users.getAll();
```

### 2. Migrations are append-only

Once a migration has been applied anywhere outside local, it's frozen. Schema changes always create a new numbered file. This is what makes `db:push` deterministic across environments and PR-reviewable.

```bash
npm run db:diff add_posts_table  # generates supabase/migrations/0005_add_posts_table.sql
```

### 3. Every public table has RLS enabled

The anon key is shipped to every client. A single un-RLSed table is a public data leak. The `scripts/check-rls.js` guard runs as part of `npm run db:push:safe` and blocks pushes that would violate this.

### 4. Every api function throws on error, never returns `{ data, error }`

Screens use `try/catch` or TanStack Query's `error` state. This matches the Convex feel and keeps error handling out of UI logic.

## Daily Workflow

| What you want to do                                  | Command                            |
| ---------------------------------------------------- | ---------------------------------- |
| Start local stack                                    | `npm run db:start`                 |
| Apply migrations + seed from scratch                 | `npm run db:reset`                 |
| Prototype a schema change in Studio, then capture it | `npm run db:diff my_change_name`   |
| Regenerate TypeScript types after schema change      | `npm run db:types`                 |
| Push migrations to remote (staging/prod)             | `npm run db:push:safe`             |
| Run the app                                          | `npm run ios` or `npm run android` |
| Stop local stack                                     | `npm run db:stop`                  |

## Adding a New Feature — e.g., a `posts` table

1. **Create the migration:**

   ```sql
   -- supabase/migrations/0005_posts_table.sql
   create table public.posts (
     id uuid primary key default extensions.uuid_generate_v4(),
     author_id uuid not null references public.users(id) on delete cascade,
     content text not null,
     created_at timestamptz not null default now()
   );

   alter table public.posts enable row level security;

   create policy "posts_read_all" on public.posts
     for select using (auth.uid() is not null);

   create policy "posts_insert_own" on public.posts
     for insert with check (auth.uid() = author_id);

   create policy "posts_delete_own" on public.posts
     for delete using (auth.uid() = author_id);
   ```

2. **Apply and regenerate types:**

   ```bash
   npm run db:reset
   npm run db:types
   ```

3. **Add the api module** — `supabase/api/posts.ts`:

   ```ts
   import { supabase } from '@/supabase/client';
   import { requireUserId, ApiError } from './_helpers';

   export const posts = {
     async list() {
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

4. **Expose it in `supabase/api/index.ts`:**

   ```ts
   export const api = { users, auth, posts };
   ```

5. **Use it in a screen:**
   ```tsx
   const { data: posts } = useQuery({
     queryKey: ['posts'],
     queryFn: api.posts.list,
   });
   const createPost = useMutation({
     mutationFn: api.posts.create,
     onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posts'] }),
   });
   ```

## Going to Production

1. **Create a hosted Supabase project** at supabase.com (you need the hosted project only for its URL and keys — the schema still comes from your migrations).

2. **Link the project:**

   ```bash
   supabase link --project-ref <your-project-ref>
   ```

3. **Push migrations:**

   ```bash
   npm run db:push:safe
   ```

4. **Update `.env.production` (or EAS secrets)** with the hosted URL and anon key.

5. **In `supabase/config.toml`**, flip `auth.email.enable_confirmations = true` and configure OAuth providers as needed.

## Realtime

For tables where you genuinely need live updates, use the built-in subscription helper pattern (see `api.users.subscribeToSelf`):

```tsx
useEffect(() => {
  const unsubscribe = api.users.subscribeToSelf((updated) => {
    queryClient.setQueryData(['auth', 'me'], updated);
  });
  return unsubscribe;
}, []);
```

Default to TanStack Query for normal data; reach for realtime only when the UX demands sub-second updates (chat, presence, collaborative editing).

## Key Differences from the Convex Template

Four things are structurally different and worth knowing up front:

**Reactivity is opt-in.** Convex re-renders on data change automatically. With Supabase, you get that only via TanStack Query invalidation or a realtime channel. Default to `invalidateQueries` in mutation `onSuccess`.

**Auth is database-backed.** The trigger in migration 0004 is what keeps `public.users` in sync with `auth.users`. Without it, you get orphaned auth users with no profile row.

**RLS is your authorization.** The `if (!userId) throw` checks from Convex functions become SQL policies. The `requireUserId()` helper is for clearer client errors, not security.

**Migrations are append-only.** Never edit a migration after it's been applied to any non-local environment — always add a new one. This is the single rule that keeps code-first viable across a team.

## License

MIT — use this however you like.
