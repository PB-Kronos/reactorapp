-- Cross-browser / cross-computer supervisor-to-unit terminal queue.
create table if not exists public.plant_remote_commands (
  id bigint generated always as identity primary key,
  room_code text not null references public.plant_rooms(code) on delete cascade,
  target_unit smallint not null check (target_unit in (1, 2)),
  command text not null check (char_length(command) between 1 and 500),
  issued_at timestamptz not null default now(),
  delivered_at timestamptz,
  completed_at timestamptz,
  result text
);

create index if not exists plant_remote_commands_pending_idx
  on public.plant_remote_commands (room_code, target_unit, id)
  where delivered_at is null;

alter table public.plant_remote_commands enable row level security;

drop policy if exists "authenticated plant command read" on public.plant_remote_commands;
drop policy if exists "authenticated plant command insert" on public.plant_remote_commands;
drop policy if exists "authenticated plant command update" on public.plant_remote_commands;

create policy "authenticated plant command read" on public.plant_remote_commands
  for select to authenticated using (true);
create policy "authenticated plant command insert" on public.plant_remote_commands
  for insert to authenticated with check (true);
create policy "authenticated plant command update" on public.plant_remote_commands
  for update to authenticated using (true) with check (true);

grant select, insert, update on public.plant_remote_commands to authenticated;
