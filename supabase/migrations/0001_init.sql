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
