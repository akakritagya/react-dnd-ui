# Kanban Board Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `react-dnd-ui` from a hardcoded drag-and-drop demo into a real, usable, multi-user Kanban task board with full CRUD, Supabase-backed auth/persistence, and a proper visual design.

**Architecture:** Vite + React 18 + TypeScript + Tailwind frontend, `react-router-dom` for `/login`, `/signup`, and the protected board route, `@hello-pangea/dnd` for drag-and-drop (replacing the archived `react-beautiful-dnd`), and Supabase (Postgres + Auth) called directly from the frontend via `@supabase/supabase-js`, with Row Level Security scoping every row to its owning user.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, `@hello-pangea/dnd`, `react-router-dom`, `@supabase/supabase-js`, Vitest.

## Global Constraints

- Path alias `@/*` maps to `./src/*` (see `vite.config.ts` / `tsconfig.json`) — use it for all intra-`src` imports, matching existing code style.
- No `boards` table — each user has exactly one implicit board (spec: `docs/superpowers/specs/2026-08-12-kanban-completion-design.md`).
- No card details beyond title (no description/due-date/labels) — out of scope.
- No OAuth — email/password auth only.
- No realtime sync — last write wins.
- Deletes require a `window.confirm(...)` before calling the delete handler.
- All CRUD/reorder mutations update local state optimistically, then persist to Supabase; on failure, roll back to the prior state and surface the error.
- Visual design tokens (defined once here, used verbatim throughout):
  - Font: keep existing Rubik (`font-rubik`, already loaded in `src/index.css`).
  - Page background: `bg-slate-50`.
  - Surface (columns, cards, forms): `bg-white border border-slate-200 rounded-xl` (cards use `rounded-lg`), `shadow-sm`.
  - Accent (buttons, focus rings, dragging state): `indigo-600` (primary), `indigo-700` (hover), `indigo-400` (focus ring / dragging ring), `indigo-50` (subtle drag-over background).
  - Destructive affordance: `text-slate-400 hover:text-rose-500` for delete icons; `text-rose-600` for error text; `bg-rose-50 border-rose-200 text-rose-700` for the error banner.
  - Inputs: `border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400`.
  - Empty/add states: `border-2 border-dashed border-slate-300 rounded-xl text-slate-400`.

---

### Task 1: Dependencies & tooling

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`

**Interfaces:**
- Produces: `@hello-pangea/dnd`, `react-router-dom`, `@supabase/supabase-js` available as runtime deps; `vitest` available as a dev dep and `npm test` script.

- [ ] **Step 1: Remove the unmaintained drag-and-drop library**

Run:
```bash
npm uninstall react-beautiful-dnd @types/react-beautiful-dnd
```

- [ ] **Step 2: Install the maintained fork and new runtime deps**

Run:
```bash
npm install @hello-pangea/dnd react-router-dom @supabase/supabase-js
```

- [ ] **Step 3: Install Vitest as a dev dependency**

Run:
```bash
npm install -D vitest
```

- [ ] **Step 4: Add a `test` script to `package.json`**

In `package.json`, inside `"scripts"`, add:
```json
"test": "vitest run"
```

- [ ] **Step 5: Enable Vitest in `vite.config.ts`**

Replace the full contents of `vite.config.ts` with:
```ts
/// <reference types="vitest" />
import * as path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/"),
      assets: path.resolve(__dirname, "./src/assets/"),
      components: path.resolve(__dirname, "./src/components/"),
      types: path.resolve(__dirname, "./src/types/"),
      utils: path.resolve(__dirname, "./src/utils/"),
    },
  },
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 6: Verify the project still type-checks**

Run: `npx tsc --noEmit`
Expected: fails only on the known-missing `react-beautiful-dnd` imports in `src/components/*.tsx` (those files are rewritten in later tasks). If it fails for any other reason, stop and investigate before continuing.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vite.config.ts
git commit -m "chore: swap react-beautiful-dnd for @hello-pangea/dnd, add supabase/router/vitest deps"
```

---

### Task 2: Pure reorder helpers (TDD)

**Files:**
- Create: `src/utils/reorder.ts`
- Test: `src/utils/reorder.test.ts`

**Interfaces:**
- Consumes: `columnData` type from `@/types/column` (existing: `{ id: string; title: string; children: columnItemData[] }`, `columnItemData: { id: string; title: string }`).
- Produces:
  - `reorderWithinColumn(columns: columnData[], columnId: string, startIndex: number, endIndex: number): columnData[]`
  - `moveBetweenColumns(columns: columnData[], sourceColumnId: string, destColumnId: string, sourceIndex: number, destIndex: number): columnData[]`
  - `reorderColumnsList(columns: columnData[], startIndex: number, endIndex: number): columnData[]`
  - All three are pure (no mutation of inputs, return a new array) — consumed by `useColumns` in Task 8.

- [ ] **Step 1: Write the failing tests**

Create `src/utils/reorder.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  reorderWithinColumn,
  moveBetweenColumns,
  reorderColumnsList,
} from "./reorder";
import { columnData } from "@/types/column";

const makeColumns = (): columnData[] => [
  {
    id: "col-a",
    title: "Column A",
    children: [
      { id: "a1", title: "A1" },
      { id: "a2", title: "A2" },
      { id: "a3", title: "A3" },
    ],
  },
  {
    id: "col-b",
    title: "Column B",
    children: [
      { id: "b1", title: "B1" },
      { id: "b2", title: "B2" },
    ],
  },
];

describe("reorderWithinColumn", () => {
  it("moves a card to a new index within the same column", () => {
    const result = reorderWithinColumn(makeColumns(), "col-a", 0, 2);
    expect(result.find((c) => c.id === "col-a")!.children.map((c) => c.id)).toEqual([
      "a2",
      "a3",
      "a1",
    ]);
  });

  it("does not mutate other columns", () => {
    const original = makeColumns();
    const result = reorderWithinColumn(original, "col-a", 0, 2);
    expect(result.find((c) => c.id === "col-b")).toEqual(original[1]);
  });

  it("does not mutate the input array", () => {
    const original = makeColumns();
    const originalOrder = original.find((c) => c.id === "col-a")!.children.map((c) => c.id);
    reorderWithinColumn(original, "col-a", 0, 2);
    expect(original.find((c) => c.id === "col-a")!.children.map((c) => c.id)).toEqual(
      originalOrder
    );
  });
});

describe("moveBetweenColumns", () => {
  it("moves a card from one column to another at the given index", () => {
    const result = moveBetweenColumns(makeColumns(), "col-a", "col-b", 1, 0);
    expect(result.find((c) => c.id === "col-a")!.children.map((c) => c.id)).toEqual([
      "a1",
      "a3",
    ]);
    expect(result.find((c) => c.id === "col-b")!.children.map((c) => c.id)).toEqual([
      "a2",
      "b1",
      "b2",
    ]);
  });
});

describe("reorderColumnsList", () => {
  it("moves a column to a new index", () => {
    const result = reorderColumnsList(makeColumns(), 0, 1);
    expect(result.map((c) => c.id)).toEqual(["col-b", "col-a"]);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run src/utils/reorder.test.ts`
Expected: FAIL — `src/utils/reorder.ts` does not exist yet.

- [ ] **Step 3: Implement the pure helpers**

Create `src/utils/reorder.ts`:
```ts
import { columnData } from "@/types/column";

export const reorderWithinColumn = (
  columns: columnData[],
  columnId: string,
  startIndex: number,
  endIndex: number
): columnData[] => {
  return columns.map((column) => {
    if (column.id !== columnId) return column;
    const children = [...column.children];
    const [moved] = children.splice(startIndex, 1);
    children.splice(endIndex, 0, moved);
    return { ...column, children };
  });
};

export const moveBetweenColumns = (
  columns: columnData[],
  sourceColumnId: string,
  destColumnId: string,
  sourceIndex: number,
  destIndex: number
): columnData[] => {
  const sourceColumn = columns.find((column) => column.id === sourceColumnId);
  if (!sourceColumn) return columns;

  const sourceChildren = [...sourceColumn.children];
  const [moved] = sourceChildren.splice(sourceIndex, 1);

  return columns.map((column) => {
    if (column.id === sourceColumnId) {
      const children = [...sourceChildren];
      if (column.id === destColumnId) {
        children.splice(destIndex, 0, moved);
      }
      return { ...column, children };
    }
    if (column.id === destColumnId) {
      const children = [...column.children];
      children.splice(destIndex, 0, moved);
      return { ...column, children };
    }
    return column;
  });
};

export const reorderColumnsList = (
  columns: columnData[],
  startIndex: number,
  endIndex: number
): columnData[] => {
  const result = [...columns];
  const [moved] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, moved);
  return result;
};
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/utils/reorder.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/reorder.ts src/utils/reorder.test.ts
git commit -m "feat: add pure reorder helpers for columns and cards"
```

---

### Task 3: Shared type updates for CRUD props

**Files:**
- Modify: `src/types/column.d.ts`

**Interfaces:**
- Produces: updated `ColumnProps`, `ColumnItemsListProps`, `ColumnItemProps` consumed by Tasks 10, 11, 12, 13.

- [ ] **Step 1: Replace the prop types**

Replace the contents of `src/types/column.d.ts` with:
```ts
export type columnItemData = {
  id: string;
  title: string;
};

export type columnData = {
  id: string;
  title: string;
  children: columnItemData[];
};

export type ColumnProps = {
  column: columnData;
  index: number;
  onRenameColumn: (columnId: string, title: string) => void;
  onDeleteColumn: (columnId: string) => void;
  onAddCard: (columnId: string, title: string) => void;
  onRenameCard: (columnId: string, cardId: string, title: string) => void;
  onDeleteCard: (columnId: string, cardId: string) => void;
};

export type ColumnItemsListProps = {
  items: columnItemData[];
  colId: string;
  onRenameCard: (columnId: string, cardId: string, title: string) => void;
  onDeleteCard: (columnId: string, cardId: string) => void;
  onAddCard: (columnId: string, title: string) => void;
};

export type ColumnItemProps = {
  item: columnItemData;
  index: number;
  onRename: (cardId: string, title: string) => void;
  onDelete: (cardId: string) => void;
};
```

- [ ] **Step 2: Verify it type-checks in isolation**

Run: `npx tsc --noEmit`
Expected: the `src/types/column.d.ts` change itself introduces no new errors (existing `Column.tsx`/`ColumnItem.tsx`/`ColumnItemsList.tsx` errors from the still-missing `react-beautiful-dnd` import and now-mismatched props are expected and get fixed in Tasks 10–12).

- [ ] **Step 3: Commit**

```bash
git add src/types/column.d.ts
git commit -m "feat: add CRUD callback props to column/card types"
```

---

### Task 4: Supabase client, SQL migration, env template, README

**Files:**
- Create: `src/lib/supabase.ts`
- Create: `supabase/migrations/0001_init.sql`
- Create: `.env.local.example`
- Create: `.env.local` (local only, gitignored via existing `*.local` rule)
- Modify: `README.md`

**Interfaces:**
- Produces: `supabase` client instance exported from `@/lib/supabase`, consumed by `AuthContext` (Task 5) and `useColumns` (Task 8).

- [ ] **Step 1: Create the Supabase client module**

Create `src/lib/supabase.ts`:
```ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables. Copy .env.local.example to .env.local and fill in your Supabase project's values."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

- [ ] **Step 2: Write the SQL migration**

Create `supabase/migrations/0001_init.sql`:
```sql
create table if not exists columns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  position integer not null,
  created_at timestamptz not null default now()
);

create table if not exists cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  column_id uuid not null references columns(id) on delete cascade,
  title text not null,
  position integer not null,
  created_at timestamptz not null default now()
);

create index if not exists cards_column_id_idx on cards(column_id);

alter table columns enable row level security;
alter table cards enable row level security;

create policy "Users can select their own columns"
  on columns for select
  using (auth.uid() = user_id);

create policy "Users can insert their own columns"
  on columns for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own columns"
  on columns for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own columns"
  on columns for delete
  using (auth.uid() = user_id);

create policy "Users can select their own cards"
  on cards for select
  using (auth.uid() = user_id);

create policy "Users can insert their own cards"
  on cards for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own cards"
  on cards for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own cards"
  on cards for delete
  using (auth.uid() = user_id);
```

- [ ] **Step 3: Create the env template (committed) and local env file (gitignored)**

Create `.env.local.example`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Create `.env.local` with the same content but placeholder values for now, so `npm run dev` doesn't crash before real credentials arrive:
```
VITE_SUPABASE_URL=https://placeholder.supabase.co
VITE_SUPABASE_ANON_KEY=placeholder-anon-key
```
(Real values get swapped in during Task 14, once the Supabase project exists. Auth/data calls will fail with network/API errors until then — that's expected and fine for developing the UI.)

- [ ] **Step 4: Confirm `.env.local` is actually ignored**

Run: `git check-ignore -v .env.local`
Expected: prints a match against the `*.local` rule in `.gitignore`. If it prints nothing, stop — do not proceed until this is confirmed, to avoid committing credentials later.

- [ ] **Step 5: Update the README with setup instructions**

Append to `README.md`:
```markdown

## Setup

1. `npm install`
2. Create a free project at https://supabase.com.
3. In the Supabase SQL editor, run the contents of `supabase/migrations/0001_init.sql`.
4. In Project Settings → API, copy the Project URL and the `anon` public key.
5. Copy `.env.local.example` to `.env.local` and fill in those two values.
6. `npm run dev`

## Testing

`npm test` runs the Vitest unit tests (currently: the card/column reorder helpers).
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase.ts supabase/migrations/0001_init.sql .env.local.example README.md
git commit -m "feat: add supabase client, schema migration, and setup docs"
```

---

### Task 5: Auth context

**Files:**
- Create: `src/auth/AuthContext.tsx`

**Interfaces:**
- Consumes: `supabase` from `@/lib/supabase` (Task 4).
- Produces:
  - `AuthProvider: React.FC<{ children: ReactNode }>`
  - `useAuth(): { session: Session | null; user: User | null; loading: boolean; signIn(email, password): Promise<{ error: string | null }>; signUp(email, password): Promise<{ error: string | null; needsEmailConfirmation: boolean }>; signOut(): Promise<void> }`
  - Consumed by: `ProtectedRoute`, `LoginPage`, `SignupPage` (Task 6), `Header`, `DnDContainer` (Tasks 7, 13).

- [ ] **Step 1: Implement the auth context**

Create `src/auth/AuthContext.tsx`:
```tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string
  ) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? error.message : null };
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    return {
      error: error ? error.message : null,
      needsEmailConfirmation: !error && !data.session,
    };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, loading, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no new errors originating from `src/auth/AuthContext.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/auth/AuthContext.tsx
git commit -m "feat: add supabase auth context"
```

---

### Task 6: ProtectedRoute, LoginPage, SignupPage

**Files:**
- Create: `src/auth/ProtectedRoute.tsx`
- Create: `src/auth/LoginPage.tsx`
- Create: `src/auth/SignupPage.tsx`

**Interfaces:**
- Consumes: `useAuth` from `./AuthContext` (Task 5); `Navigate`, `Outlet`, `Link`, `useNavigate` from `react-router-dom` (Task 1).
- Produces: `ProtectedRoute`, `LoginPage`, `SignupPage` React components, consumed by `App.tsx` routing (Task 7).

- [ ] **Step 1: Implement `ProtectedRoute`**

Create `src/auth/ProtectedRoute.tsx`:
```tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";

const ProtectedRoute = () => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-slate-50 font-rubik">
        <p className="text-slate-400">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
```

- [ ] **Step 2: Implement `LoginPage`**

Create `src/auth/LoginPage.tsx`:
```tsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

const LoginPage: React.FC = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await signIn(email, password);
    setSubmitting(false);
    if (signInError) {
      setError(signInError);
      return;
    }
    navigate("/");
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-slate-50 font-rubik">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm flex flex-col gap-4 bg-white border border-slate-200 rounded-xl shadow-sm p-8"
      >
        <h1 className="text-xl font-semibold text-slate-800 text-center">Log in</h1>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="bg-indigo-600 text-white font-medium rounded-lg px-3 py-2 hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {submitting ? "Logging in..." : "Log in"}
        </button>
        <p className="text-sm text-slate-500 text-center">
          No account?{" "}
          <Link to="/signup" className="text-indigo-600 font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
};

export default LoginPage;
```

- [ ] **Step 3: Implement `SignupPage`**

Create `src/auth/SignupPage.tsx`:
```tsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

const SignupPage: React.FC = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setInfo(null);
    const { error: signUpError, needsEmailConfirmation } = await signUp(email, password);
    setSubmitting(false);
    if (signUpError) {
      setError(signUpError);
      return;
    }
    if (needsEmailConfirmation) {
      setInfo("Check your email to confirm your account, then log in.");
      return;
    }
    navigate("/");
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-slate-50 font-rubik">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm flex flex-col gap-4 bg-white border border-slate-200 rounded-xl shadow-sm p-8"
      >
        <h1 className="text-xl font-semibold text-slate-800 text-center">Sign up</h1>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 6 characters)"
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        {error && <p className="text-sm text-rose-600">{error}</p>}
        {info && <p className="text-sm text-emerald-600">{info}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="bg-indigo-600 text-white font-medium rounded-lg px-3 py-2 hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {submitting ? "Signing up..." : "Sign up"}
        </button>
        <p className="text-sm text-slate-500 text-center">
          Already have an account?{" "}
          <Link to="/login" className="text-indigo-600 font-medium hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
};

export default SignupPage;
```

- [ ] **Step 4: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no new errors from `src/auth/*.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/auth/ProtectedRoute.tsx src/auth/LoginPage.tsx src/auth/SignupPage.tsx
git commit -m "feat: add protected route, login, and signup pages"
```

---

### Task 7: Router wiring, Header, BoardPage

**Files:**
- Create: `src/components/Header.tsx`
- Create: `src/components/BoardPage.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `AuthProvider`, `useAuth` (Task 5); `ProtectedRoute`, `LoginPage`, `SignupPage` (Task 6); `DnDContainer` (existing, rewritten in Task 13).
- Produces: `Header`, `BoardPage` components; `App.tsx` now provides router + auth context for the whole tree.

- [ ] **Step 1: Implement `Header`**

Create `src/components/Header.tsx`:
```tsx
import { useAuth } from "@/auth/AuthContext";

const Header = () => {
  const { user, signOut } = useAuth();

  return (
    <header className="w-full flex items-center justify-between px-8 py-4 border-b border-slate-200 bg-white font-rubik">
      <h1 className="text-xl font-semibold text-slate-800">Kanban</h1>
      <div className="flex items-center gap-4">
        <span className="text-sm text-slate-500">{user?.email}</span>
        <button
          onClick={signOut}
          className="text-sm font-medium text-slate-500 hover:text-rose-500 transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
};

export default Header;
```

- [ ] **Step 2: Implement `BoardPage`**

Create `src/components/BoardPage.tsx`:
```tsx
import Header from "./Header";
import DnDContainer from "./DnDContainer";

const BoardPage = () => (
  <div className="w-screen min-h-screen bg-slate-50 flex flex-col font-rubik">
    <Header />
    <main className="flex-1 flex flex-col items-center py-8 gap-4">
      <DnDContainer />
    </main>
  </div>
);

export default BoardPage;
```

- [ ] **Step 3: Rewrite `App.tsx` to wire the router and auth provider**

Replace the full contents of `src/App.tsx` with:
```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AuthProvider } from "@/auth/AuthContext";
import ProtectedRoute from "@/auth/ProtectedRoute";
import LoginPage from "@/auth/LoginPage";
import SignupPage from "@/auth/SignupPage";
import BoardPage from "./components/BoardPage";

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<BoardPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
```

- [ ] **Step 4: Smoke-test with the dev server**

Run: `npm run dev`, open the printed local URL.
Expected: since `.env.local` currently has placeholder Supabase values (Task 4), you should be redirected to `/login` and see the login form render correctly (submitting it will fail with a network/API error — that's expected until Task 14). Stop the dev server after checking.

- [ ] **Step 5: Commit**

```bash
git add src/components/Header.tsx src/components/BoardPage.tsx src/App.tsx
git commit -m "feat: wire router, auth provider, header, and board page"
```

---

### Task 8: `useColumns` hook

**Files:**
- Create: `src/hooks/useColumns.ts`
- Delete: `src/hooks/useLocalStorage.ts` (superseded by this hook)

**Interfaces:**
- Consumes: `supabase` (Task 4), `columnData`/`columnItemData` types (existing), `reorderWithinColumn`/`moveBetweenColumns`/`reorderColumnsList` (Task 2).
- Produces: `useColumns(userId: string)` returning:
  ```ts
  {
    columns: columnData[];
    loading: boolean;
    error: string | null;
    dismissError: () => void;
    refetch: () => Promise<void>;
    addColumn: (title: string) => Promise<void>;
    renameColumn: (columnId: string, title: string) => Promise<void>;
    deleteColumn: (columnId: string) => Promise<void>;
    addCard: (columnId: string, title: string) => Promise<void>;
    renameCard: (columnId: string, cardId: string, title: string) => Promise<void>;
    deleteCard: (columnId: string, cardId: string) => Promise<void>;
    reorderCardsWithinColumn: (columnId: string, startIndex: number, endIndex: number) => Promise<void>;
    moveCardBetweenColumns: (sourceColumnId: string, destColumnId: string, sourceIndex: number, destIndex: number) => Promise<void>;
    reorderColumns: (startIndex: number, endIndex: number) => Promise<void>;
  }
  ```
  Consumed by `DnDContainer` (Task 13).

- [ ] **Step 1: Delete the now-superseded localStorage hook**

Run: `git rm src/hooks/useLocalStorage.ts`

- [ ] **Step 2: Implement `useColumns`**

Create `src/hooks/useColumns.ts`:
```ts
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { columnData } from "@/types/column";
import {
  reorderWithinColumn,
  moveBetweenColumns,
  reorderColumnsList,
} from "@/utils/reorder";

type ColumnRow = { id: string; title: string; position: number };
type CardRow = { id: string; column_id: string; title: string; position: number };
type PersistResult = { error: { message: string } | null };

const assembleColumns = (columnRows: ColumnRow[], cardRows: CardRow[]): columnData[] =>
  columnRows
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((col) => ({
      id: col.id,
      title: col.title,
      children: cardRows
        .filter((card) => card.column_id === col.id)
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((card) => ({ id: card.id, title: card.title })),
    }));

const useColumns = (userId: string) => {
  const [columns, setColumns] = useState<columnData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchColumns = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [columnsRes, cardsRes] = await Promise.all([
      supabase.from("columns").select("id, title, position").eq("user_id", userId).order("position"),
      supabase
        .from("cards")
        .select("id, column_id, title, position")
        .eq("user_id", userId)
        .order("position"),
    ]);

    if (columnsRes.error || cardsRes.error) {
      setError((columnsRes.error ?? cardsRes.error)!.message);
      setLoading(false);
      return;
    }

    setColumns(assembleColumns(columnsRes.data ?? [], cardsRes.data ?? []));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchColumns();
  }, [fetchColumns]);

  const dismissError = () => setError(null);

  const withRollback = async (
    previousColumns: columnData[],
    optimisticColumns: columnData[],
    persist: () => Promise<PersistResult>
  ) => {
    setColumns(optimisticColumns);
    const { error: persistError } = await persist();
    if (persistError) {
      setColumns(previousColumns);
      setError(persistError.message);
    }
  };

  const addColumn = async (title: string) => {
    const tempId = crypto.randomUUID();
    const previousColumns = columns;
    setColumns([...columns, { id: tempId, title, children: [] }]);

    const { data, error: insertError } = await supabase
      .from("columns")
      .insert({ user_id: userId, title, position: previousColumns.length })
      .select("id")
      .single();

    if (insertError || !data) {
      setColumns(previousColumns);
      setError(insertError?.message ?? "Failed to create column");
      return;
    }

    setColumns((current) =>
      current.map((col) => (col.id === tempId ? { ...col, id: data.id } : col))
    );
  };

  const renameColumn = async (columnId: string, title: string) => {
    const previousColumns = columns;
    const optimisticColumns = columns.map((col) => (col.id === columnId ? { ...col, title } : col));
    await withRollback(previousColumns, optimisticColumns, () =>
      supabase.from("columns").update({ title }).eq("id", columnId)
    );
  };

  const deleteColumn = async (columnId: string) => {
    const previousColumns = columns;
    const optimisticColumns = columns.filter((col) => col.id !== columnId);
    await withRollback(previousColumns, optimisticColumns, () =>
      supabase.from("columns").delete().eq("id", columnId)
    );
  };

  const addCard = async (columnId: string, title: string) => {
    const column = columns.find((col) => col.id === columnId);
    if (!column) return;

    const tempId = crypto.randomUUID();
    const previousColumns = columns;
    setColumns(
      columns.map((col) =>
        col.id === columnId ? { ...col, children: [...col.children, { id: tempId, title }] } : col
      )
    );

    const { data, error: insertError } = await supabase
      .from("cards")
      .insert({ user_id: userId, column_id: columnId, title, position: column.children.length })
      .select("id")
      .single();

    if (insertError || !data) {
      setColumns(previousColumns);
      setError(insertError?.message ?? "Failed to create card");
      return;
    }

    setColumns((current) =>
      current.map((col) =>
        col.id === columnId
          ? { ...col, children: col.children.map((c) => (c.id === tempId ? { ...c, id: data.id } : c)) }
          : col
      )
    );
  };

  const renameCard = async (columnId: string, cardId: string, title: string) => {
    const previousColumns = columns;
    const optimisticColumns = columns.map((col) =>
      col.id === columnId
        ? { ...col, children: col.children.map((c) => (c.id === cardId ? { ...c, title } : c)) }
        : col
    );
    await withRollback(previousColumns, optimisticColumns, () =>
      supabase.from("cards").update({ title }).eq("id", cardId)
    );
  };

  const deleteCard = async (columnId: string, cardId: string) => {
    const previousColumns = columns;
    const optimisticColumns = columns.map((col) =>
      col.id === columnId ? { ...col, children: col.children.filter((c) => c.id !== cardId) } : col
    );
    await withRollback(previousColumns, optimisticColumns, () =>
      supabase.from("cards").delete().eq("id", cardId)
    );
  };

  const persistCardPositions = async (cards: { id: string }[]): Promise<PersistResult> => {
    const results = await Promise.all(
      cards.map((card, index) => supabase.from("cards").update({ position: index }).eq("id", card.id))
    );
    const failed = results.find((r) => r.error);
    return { error: failed?.error ?? null };
  };

  const reorderCardsWithinColumn = async (columnId: string, startIndex: number, endIndex: number) => {
    const previousColumns = columns;
    const optimisticColumns = reorderWithinColumn(columns, columnId, startIndex, endIndex);
    const column = optimisticColumns.find((col) => col.id === columnId)!;
    await withRollback(previousColumns, optimisticColumns, () => persistCardPositions(column.children));
  };

  const moveCardBetweenColumns = async (
    sourceColumnId: string,
    destColumnId: string,
    sourceIndex: number,
    destIndex: number
  ) => {
    const previousColumns = columns;
    const optimisticColumns = moveBetweenColumns(
      columns,
      sourceColumnId,
      destColumnId,
      sourceIndex,
      destIndex
    );
    const sourceColumn = optimisticColumns.find((col) => col.id === sourceColumnId)!;
    const destColumn = optimisticColumns.find((col) => col.id === destColumnId)!;
    const movedCard = destColumn.children[destIndex];

    await withRollback(previousColumns, optimisticColumns, async () => {
      const { error: moveError } = await supabase
        .from("cards")
        .update({ column_id: destColumnId })
        .eq("id", movedCard.id);
      if (moveError) return { error: moveError };

      const [sourceResult, destResult] = await Promise.all([
        persistCardPositions(sourceColumn.children),
        persistCardPositions(destColumn.children),
      ]);
      return { error: sourceResult.error ?? destResult.error };
    });
  };

  const reorderColumns = async (startIndex: number, endIndex: number) => {
    const previousColumns = columns;
    const optimisticColumns = reorderColumnsList(columns, startIndex, endIndex);
    await withRollback(previousColumns, optimisticColumns, async () => {
      const results = await Promise.all(
        optimisticColumns.map((col, index) =>
          supabase.from("columns").update({ position: index }).eq("id", col.id)
        )
      );
      const failed = results.find((r) => r.error);
      return { error: failed?.error ?? null };
    });
  };

  return {
    columns,
    loading,
    error,
    dismissError,
    refetch: fetchColumns,
    addColumn,
    renameColumn,
    deleteColumn,
    addCard,
    renameCard,
    deleteCard,
    reorderCardsWithinColumn,
    moveCardBetweenColumns,
    reorderColumns,
  };
};

export default useColumns;
```

- [ ] **Step 3: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no new errors from `src/hooks/useColumns.ts`.

- [ ] **Step 4: Commit**

```bash
git add -A src/hooks/
git commit -m "feat: add useColumns hook for supabase-backed board state"
```

---

### Task 9: ErrorBanner

**Files:**
- Create: `src/components/ErrorBanner.tsx`

**Interfaces:**
- Produces: `ErrorBanner: React.FC<{ message: string; onDismiss: () => void }>`, consumed by `DnDContainer` (Task 13).

- [ ] **Step 1: Implement `ErrorBanner`**

Create `src/components/ErrorBanner.tsx`:
```tsx
type ErrorBannerProps = {
  message: string;
  onDismiss: () => void;
};

const ErrorBanner = ({ message, onDismiss }: ErrorBannerProps) => (
  <div className="w-full max-w-3xl flex items-center justify-between gap-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-4 py-2 text-sm">
    <span>{message}</span>
    <button onClick={onDismiss} className="font-medium hover:text-rose-900">
      Dismiss
    </button>
  </div>
);

export default ErrorBanner;
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/components/ErrorBanner.tsx
git commit -m "feat: add dismissible error banner"
```

---

### Task 10: `ColumnItem` (card) rewrite

**Files:**
- Modify: `src/components/ColumnItem.tsx`

**Interfaces:**
- Consumes: `ColumnItemProps` (Task 3), `Draggable` from `@hello-pangea/dnd` (Task 1).
- Produces: `ColumnItem` unchanged public shape (`item`, `index`, now also `onRename`, `onDelete`), consumed by `ColumnItemsList` (Task 11).

- [ ] **Step 1: Rewrite the component**

Replace the full contents of `src/components/ColumnItem.tsx` with:
```tsx
import React, { useState } from "react";
import { Draggable } from "@hello-pangea/dnd";

import { ColumnItemProps } from "@/types/column";

const ColumnItem: React.FC<ColumnItemProps> = ({ item, index, onRename, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(item.title);

  const commitRename = () => {
    setIsEditing(false);
    const trimmed = title.trim();
    if (trimmed && trimmed !== item.title) {
      onRename(item.id, trimmed);
    } else {
      setTitle(item.title);
    }
  };

  return (
    <Draggable draggableId={item.id} index={index} key={item.id}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`group w-60 flex items-center justify-between gap-2 px-4 py-3 border rounded-lg font-medium transition-colors ease-in duration-150 ${
            snapshot.isDragging
              ? "border-indigo-400 ring-2 ring-indigo-400 shadow-md bg-white"
              : "border-slate-200 bg-white hover:border-indigo-300"
          }`}
        >
          <div {...provided.dragHandleProps} className="flex-1 cursor-grab min-w-0">
            {isEditing ? (
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") {
                    setTitle(item.title);
                    setIsEditing(false);
                  }
                }}
                className="w-full border border-indigo-300 rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            ) : (
              <span onClick={() => setIsEditing(true)} className="block truncate">
                {item.title}
              </span>
            )}
          </div>
          <button
            onClick={() => {
              if (window.confirm(`Delete "${item.title}"?`)) {
                onDelete(item.id);
              }
            }}
            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-opacity"
            aria-label="Delete card"
          >
            ×
          </button>
        </div>
      )}
    </Draggable>
  );
};

export default ColumnItem;
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors from `src/components/ColumnItem.tsx` itself (errors from `ColumnItemsList.tsx`/`Column.tsx` not yet passing the new props are expected until Tasks 11–12).

- [ ] **Step 3: Commit**

```bash
git add src/components/ColumnItem.tsx
git commit -m "feat: add inline rename/delete to card, swap to @hello-pangea/dnd"
```

---

### Task 11: `ColumnItemsList` rewrite

**Files:**
- Modify: `src/components/ColumnItemsList.tsx`

**Interfaces:**
- Consumes: `ColumnItemsListProps` (Task 3), `ColumnItem` (Task 10), `Droppable` from `@hello-pangea/dnd`.
- Produces: `ColumnItemsList` consumed by `Column` (Task 12).

- [ ] **Step 1: Rewrite the component**

Replace the full contents of `src/components/ColumnItemsList.tsx` with:
```tsx
import React, { useState } from "react";
import { Droppable } from "@hello-pangea/dnd";

import ColumnItem from "./ColumnItem";
import { ColumnItemsListProps } from "@/types/column";

const ColumnItemsList: React.FC<ColumnItemsListProps> = ({
  items,
  colId,
  onRenameCard,
  onDeleteCard,
  onAddCard,
}) => {
  const [newCardTitle, setNewCardTitle] = useState("");

  const handleAddCard = () => {
    const trimmed = newCardTitle.trim();
    if (!trimmed) return;
    onAddCard(colId, trimmed);
    setNewCardTitle("");
  };

  return (
    <Droppable droppableId={colId} key={colId} type="item">
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`flex flex-col gap-3 p-4 transition-colors ease-in duration-150 ${
            snapshot.isDraggingOver ? "bg-indigo-50" : "bg-white"
          }`}
        >
          {items.map((item, index) => (
            <ColumnItem
              key={item.id}
              item={item}
              index={index}
              onRename={(cardId, title) => onRenameCard(colId, cardId, title)}
              onDelete={(cardId) => onDeleteCard(colId, cardId)}
            />
          ))}
          {provided.placeholder}
          <div className="flex gap-2">
            <input
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCard()}
              placeholder="Add a card"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              onClick={handleAddCard}
              className="bg-indigo-600 text-white text-sm font-medium rounded-lg px-3 py-1.5 hover:bg-indigo-700 transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </Droppable>
  );
};

export default ColumnItemsList;
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/components/ColumnItemsList.tsx
git commit -m "feat: add card-creation form to column item list"
```

---

### Task 12: `Column` rewrite, `AddColumnForm`, `EmptyState`

**Files:**
- Modify: `src/components/Column.tsx`
- Create: `src/components/AddColumnForm.tsx`
- Create: `src/components/EmptyState.tsx`

**Interfaces:**
- Consumes: `ColumnProps` (Task 3), `ColumnItemsList` (Task 11), `Draggable` from `@hello-pangea/dnd`.
- Produces: `Column`, `AddColumnForm: React.FC<{ onAddColumn: (title: string) => void }>`, `EmptyState: React.FC`, all consumed by `DnDContainer` (Task 13).

- [ ] **Step 1: Rewrite `Column`**

Replace the full contents of `src/components/Column.tsx` with:
```tsx
import React, { useState } from "react";
import { Draggable } from "@hello-pangea/dnd";

import { ColumnProps } from "@/types/column";
import ColumnItemsList from "./ColumnItemsList";

const Column: React.FC<ColumnProps> = ({
  column,
  index,
  onRenameColumn,
  onDeleteColumn,
  onAddCard,
  onRenameCard,
  onDeleteCard,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(column.title);

  const commitRename = () => {
    setIsEditing(false);
    const trimmed = title.trim();
    if (trimmed && trimmed !== column.title) {
      onRenameColumn(column.id, trimmed);
    } else {
      setTitle(column.title);
    }
  };

  return (
    <Draggable draggableId={column.id} index={index} key={column.id}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`group w-72 h-max bg-white border rounded-xl shadow-sm transition-colors ease-in duration-150 ${
            snapshot.isDragging ? "border-indigo-400 ring-2 ring-indigo-400" : "border-slate-200"
          }`}
        >
          <div
            {...provided.dragHandleProps}
            className="flex items-center justify-between px-4 py-3 border-b border-slate-200 cursor-grab"
          >
            {isEditing ? (
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") {
                    setTitle(column.title);
                    setIsEditing(false);
                  }
                }}
                className="flex-1 border border-indigo-300 rounded px-1 py-0.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            ) : (
              <h2
                onClick={() => setIsEditing(true)}
                className="flex-1 font-semibold text-slate-700 truncate"
              >
                {column.title}
              </h2>
            )}
            <button
              onClick={() => {
                if (window.confirm(`Delete "${column.title}" and all its cards?`)) {
                  onDeleteColumn(column.id);
                }
              }}
              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-opacity ml-2"
              aria-label="Delete column"
            >
              ×
            </button>
          </div>
          <ColumnItemsList
            items={column.children}
            colId={column.id}
            onRenameCard={onRenameCard}
            onDeleteCard={onDeleteCard}
            onAddCard={onAddCard}
          />
        </div>
      )}
    </Draggable>
  );
};

export default Column;
```

- [ ] **Step 2: Implement `AddColumnForm`**

Create `src/components/AddColumnForm.tsx`:
```tsx
import React, { useState } from "react";

type AddColumnFormProps = {
  onAddColumn: (title: string) => void;
};

const AddColumnForm: React.FC<AddColumnFormProps> = ({ onAddColumn }) => {
  const [title, setTitle] = useState("");

  const handleSubmit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onAddColumn(trimmed);
    setTitle("");
  };

  return (
    <div className="w-72 h-max flex flex-col gap-2 p-4 border-2 border-dashed border-slate-300 rounded-xl">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        placeholder="New column title"
        className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
      <button
        onClick={handleSubmit}
        className="bg-indigo-600 text-white text-sm font-medium rounded-lg px-3 py-1.5 hover:bg-indigo-700 transition-colors"
      >
        Add column
      </button>
    </div>
  );
};

export default AddColumnForm;
```

- [ ] **Step 3: Implement `EmptyState`**

Create `src/components/EmptyState.tsx`:
```tsx
import React from "react";

const EmptyState: React.FC = () => (
  <div className="w-full max-w-md flex flex-col items-center gap-2 text-center py-12 border-2 border-dashed border-slate-300 rounded-xl text-slate-400">
    <p className="font-medium">No columns yet</p>
    <p className="text-sm">Create your first column to start organizing tasks.</p>
  </div>
);

export default EmptyState;
```

- [ ] **Step 4: Verify it type-checks**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/components/Column.tsx src/components/AddColumnForm.tsx src/components/EmptyState.tsx
git commit -m "feat: add inline rename/delete to column, add-column form, empty state"
```

---

### Task 13: `DnDContainer` integration, cleanup

**Files:**
- Modify: `src/components/DnDContainer.tsx`
- Delete: `src/utils/dummy-data.ts`

**Interfaces:**
- Consumes: `useColumns` (Task 8), `useAuth` (Task 5), `Column`/`AddColumnForm`/`EmptyState` (Task 12), `ErrorBanner` (Task 9), `DragDropContext`/`Droppable` from `@hello-pangea/dnd`.
- Produces: fully wired board — this is the last piece connecting everything built in Tasks 1–12.

- [ ] **Step 1: Delete the dummy data file**

Run: `git rm src/utils/dummy-data.ts`

- [ ] **Step 2: Rewrite `DnDContainer`**

Replace the full contents of `src/components/DnDContainer.tsx` with:
```tsx
import { DragDropContext, Droppable, DropResult } from "@hello-pangea/dnd";

import Column from "./Column";
import AddColumnForm from "./AddColumnForm";
import EmptyState from "./EmptyState";
import ErrorBanner from "./ErrorBanner";
import useColumns from "@/hooks/useColumns";
import { useAuth } from "@/auth/AuthContext";

const DnDContainer = () => {
  const { user } = useAuth();
  const {
    columns,
    loading,
    error,
    dismissError,
    refetch,
    addColumn,
    renameColumn,
    deleteColumn,
    addCard,
    renameCard,
    deleteCard,
    reorderCardsWithinColumn,
    moveCardBetweenColumns,
    reorderColumns,
  } = useColumns(user!.id);

  const onDragEnd = (result: DropResult) => {
    const { source, destination, type } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    if (type === "item") {
      if (source.droppableId === destination.droppableId) {
        reorderCardsWithinColumn(source.droppableId, source.index, destination.index);
      } else {
        moveCardBetweenColumns(
          source.droppableId,
          destination.droppableId,
          source.index,
          destination.index
        );
      }
      return;
    }

    if (type === "column") {
      reorderColumns(source.index, destination.index);
    }
  };

  if (loading) {
    return <p className="text-slate-400">Loading your board...</p>;
  }

  // error with zero columns means the initial fetch itself failed (a
  // successful fetch for a brand-new user still yields columns: [] with
  // error: null), so this is unambiguously the "retry the load" case.
  if (error && columns.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="text-rose-600 text-sm">{error}</p>
        <button
          onClick={refetch}
          className="bg-indigo-600 text-white text-sm font-medium rounded-lg px-3 py-1.5 hover:bg-indigo-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center gap-4">
      {error && <ErrorBanner message={error} onDismiss={dismissError} />}
      <DragDropContext onDragEnd={onDragEnd} key="drag-drop-context">
        <Droppable droppableId="container" key="container" direction="horizontal" type="column">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="w-full h-max flex justify-center flex-wrap gap-8 px-8"
            >
              {columns.map((column, index) => (
                <Column
                  key={column.id}
                  column={column}
                  index={index}
                  onRenameColumn={renameColumn}
                  onDeleteColumn={deleteColumn}
                  onAddCard={addCard}
                  onRenameCard={renameCard}
                  onDeleteCard={deleteCard}
                />
              ))}
              {provided.placeholder}
              <AddColumnForm onAddColumn={addColumn} />
            </div>
          )}
        </Droppable>
      </DragDropContext>
      {columns.length === 0 && <EmptyState />}
    </div>
  );
};

export default DnDContainer;
```

- [ ] **Step 3: Verify the whole project type-checks cleanly**

Run: `npx tsc --noEmit`
Expected: PASS with zero errors. If anything remains, fix it now — this is the integration point for every earlier task.

- [ ] **Step 4: Run the full unit test suite**

Run: `npm test`
Expected: PASS (reorder helper tests from Task 2).

- [ ] **Step 5: Smoke-test with the dev server**

Run: `npm run dev`, open the printed local URL.
Expected: redirected to `/login` (placeholder Supabase env still in place). Login/signup forms render; submitting fails with a network/API error, which is expected until Task 14 supplies real credentials.

- [ ] **Step 6: Commit**

```bash
git add -A src/components/DnDContainer.tsx src/utils/
git commit -m "feat: wire board UI to useColumns, remove dummy data"
```

---

### Task 14: Live Supabase integration & manual QA

**Requires:** a real Supabase project URL + anon key from the user (see the `README.md` Setup section written in Task 4). Do not start this task until those are available.

**Files:**
- Modify: `.env.local` (not committed)

- [ ] **Step 1: Run the migration against the real project**

In the Supabase SQL editor for the user's project, run the full contents of `supabase/migrations/0001_init.sql`.

- [ ] **Step 2: Swap in real credentials**

Update `.env.local` with the real `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` values provided by the user.

- [ ] **Step 3: Manual QA pass**

Run: `npm run dev`, then in the browser:
1. Sign up with a new email/password. Confirm either immediate redirect to `/` or the "check your email" message, matching the project's Supabase email-confirmation setting.
2. If email confirmation is required, confirm it, then log in.
3. Create two columns. Confirm both appear and persist after a page refresh.
4. Add several cards to each column. Confirm they persist after refresh.
5. Rename a column and a card inline; confirm the change persists after refresh.
6. Drag a card to reorder it within a column; refresh; confirm order persisted.
7. Drag a card into a different column; refresh; confirm it moved.
8. Drag a column to reorder columns; refresh; confirm order persisted.
9. Delete a card, then delete a column; confirm both require a confirmation dialog and disappear.
10. Sign out; confirm redirect to `/login`.
11. Sign back in (or sign up as a second user); confirm the board is empty/separate — i.e., data is isolated per user.

- [ ] **Step 4: Fix any issues found during QA**

If any step above fails, fix the underlying code (not just the symptom), re-run the affected step, and commit the fix separately with a message describing what was broken.

- [ ] **Step 5: Final commit**

If QA passed without needing fixes, no commit is needed for this task (`.env.local` is gitignored). If fixes were made in Step 4, ensure each fix was already committed there.
