# Kanban board completion — design

Date: 2026-08-12

## Context

`react-dnd-ui` is currently a drag-and-drop *interaction demo*, not a usable app: it
renders three hardcoded columns of hardcoded cards (`src/utils/dummy-data.ts`) that can
be reordered via `react-beautiful-dnd` and persisted to `localStorage`. There is no way
to create, rename, or delete a column or a card. This design completes it into a real,
usable, multi-user Kanban task board.

## Goals

- Full CRUD for columns and cards (create, rename, delete), in addition to the existing
  drag-to-reorder behavior.
- Real, multi-device persistence via a backend, with per-user accounts so each user's
  board is private.
- A visual design pass, since the app now has real UI (forms, buttons, empty states,
  auth screens) beyond three static columns.

## Non-goals

- Multiple boards per user (each user has exactly one implicit board).
- Card details beyond a title (no description, due dates, labels, attachments).
- Realtime multi-device sync (last write wins; no websocket/live updates).
- OAuth providers — email/password auth only.
- Automated E2E/browser test suite.

## Architecture & stack

- **Frontend:** Vite + React 18 + TypeScript + Tailwind (unchanged), plus
  `react-router-dom` for `/login`, `/signup`, and the board page.
- **Drag-and-drop:** replace `react-beautiful-dnd` with **`@hello-pangea/dnd`**, a
  maintained fork with an identical API (`DragDropContext`/`Droppable`/`Draggable`).
  `react-beautiful-dnd` is archived/unmaintained; since every DnD component is already
  being rewritten to add CRUD controls, this swap is done in the same pass.
- **Backend:** Supabase — Postgres database + built-in Auth, called directly from the
  frontend via `@supabase/supabase-js`. No custom server.
- **Data isolation:** Postgres Row Level Security (RLS) policies scope every row to
  `auth.uid()`.
- **Setup dependency:** a Supabase project must be created by the user (free tier) and
  its URL + anon key supplied via a `.env` file (`VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`), gitignored. The implementation includes a SQL migration
  file to run in the Supabase SQL editor to create tables and RLS policies.

## Data model

```sql
create table columns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  position integer not null,
  created_at timestamptz not null default now()
);

create table cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  column_id uuid not null references columns(id) on delete cascade,
  title text not null,
  position integer not null,
  created_at timestamptz not null default now()
);

-- RLS: enable on both tables; policies restrict select/insert/update/delete to
-- rows where user_id = auth.uid().
```

- `position` orders cards within a column, and orders columns among themselves
  (same role as today's in-memory `columnsOrder` array, now persisted per-row).
- No `boards` table: each user has exactly one implicit board (their own columns).
- New users start with **zero columns** — an empty-state prompt invites them to create
  their first column, rather than being seeded with the old demo data.

## Components & pages

```
src/
  lib/supabase.ts          — Supabase client init (reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
  auth/
    AuthContext.tsx        — session state; signIn/signUp/signOut via supabase.auth
    ProtectedRoute.tsx     — redirects to /login if no session
    LoginPage.tsx / SignupPage.tsx
  components/
    Header.tsx             — app title, signed-in user's email, sign-out button
    DnDContainer.tsx        — fetches the user's columns+cards on mount, owns onDragEnd,
                               persists reorders to Supabase
    Column.tsx              — + inline rename, + delete (with confirm), + "add card" control
    ColumnItem.tsx (Card)   — + inline rename, + delete (with confirm)
    AddColumnForm.tsx       — new column input + submit
    EmptyState.tsx          — shown when the user has zero columns
  hooks/
    useColumns.ts           — replaces useLocalStorage; fetch + CRUD + reorder against
                               Supabase, holds the in-memory board state
```

- `src/hooks/useLocalStorage.ts` and `src/utils/dummy-data.ts` are deleted.
- Delete on a column or card requires a confirm step (browser `confirm()` is sufficient;
  no need for a custom modal).
- Visual redesign is applied to these components as they're built — the current bare
  purple/fuchsia look is replaced using the `frontend-design` skill during
  implementation, since there's now real UI (forms, buttons, empty states, auth
  screens) to design for, not just three static columns.

## Data flow

On login, `useColumns` fetches all of the user's columns and cards ordered by
`position` and assembles the same `columnData[]` shape the existing rendering code
already expects (`{ id, title, children: [{ id, title }] }[]`). Every mutation
(add/rename/delete/reorder) updates local state immediately (optimistic), then fires
the matching Supabase call. On failure, local state is reverted to its prior value and
an error is surfaced (see below). Drag-end reordering recomputes `position` for every
affected row — the same reorder logic that exists today in `DnDContainer.onDragEnd`,
just persisted to Supabase instead of `localStorage`.

## Error handling

- **Auth errors** (invalid credentials, email already registered, weak password): shown
  inline on the login/signup form, next to the submit button.
- **CRUD/network errors**: shown as a small dismissible banner at the top of the board;
  the optimistic change that triggered the error is rolled back.
- **Initial load**: a loading state covers the board while the first fetch is in
  flight; a distinct error state is shown if the initial fetch itself fails, with a
  retry action.

## Testing

- Vitest unit tests for the pure position-recomputation helpers: reordering cards
  within a column, moving a card across columns, and reordering columns. This is the
  trickiest logic in the app and is UI-independent, so it's tested directly.
- Manual QA via the `run` skill once a Supabase project is wired up: sign up, log in,
  create/rename/delete columns and cards, drag-reorder within and across columns,
  reorder columns, refresh the page to confirm persistence, sign out and back in (or as
  a second user) to confirm data isolation.
- No automated E2E/browser test suite (out of scope for this project's size).

## Open items for the implementation plan

- Exact Supabase SQL migration file and RLS policy statements.
- Exact Tailwind visual direction (colors/typography) — decided during implementation
  via the `frontend-design` skill, not fixed here.
