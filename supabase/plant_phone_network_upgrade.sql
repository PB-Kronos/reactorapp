-- Shared inter-unit / supervisor manual telephone traffic.
create table if not exists public.plant_phone_messages (
  id bigint generated always as identity primary key,
  room_code text not null references public.plant_rooms(code) on delete cascade,
  conversation_id text not null check (char_length(conversation_id) between 3 and 100),
  source_extension text not null check (char_length(source_extension) between 1 and 12),
  source_label text not null check (char_length(source_label) between 1 and 80),
  target_extension text not null check (char_length(target_extension) between 1 and 12),
  target_label text not null check (char_length(target_label) between 1 and 80),
  body text not null check (char_length(body) between 1 and 1000),
  priority text not null default 'normal' check (priority in ('normal', 'urgent')),
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists plant_phone_messages_room_idx
  on public.plant_phone_messages (room_code, id);

alter table public.plant_phone_messages enable row level security;

drop policy if exists "authenticated plant phone read" on public.plant_phone_messages;
drop policy if exists "authenticated plant phone insert" on public.plant_phone_messages;
create policy "authenticated plant phone read" on public.plant_phone_messages
  for select to authenticated using (true);
create policy "authenticated plant phone insert" on public.plant_phone_messages
  for insert to authenticated with check (true);

drop policy if exists "authenticated plant phone update" on public.plant_phone_messages;
create policy "authenticated plant phone update" on public.plant_phone_messages
  for update to authenticated using (true) with check (true);

grant select, insert, update on public.plant_phone_messages to authenticated;
