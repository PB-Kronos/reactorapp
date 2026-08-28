-- Private pickup-style calls are deliberately separate from persistent PMS.
create table if not exists public.plant_phone_calls (
  id uuid primary key default gen_random_uuid(),
  room_code text not null references public.plant_rooms(code) on delete cascade,
  source_extension text not null,
  source_label text not null,
  target_extension text not null,
  target_label text not null,
  status text not null default 'ringing' check (status in ('ringing', 'connected', 'declined', 'ended')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz
);
create table if not exists public.plant_phone_call_messages (
  id bigint generated always as identity primary key,
  call_id uuid not null references public.plant_phone_calls(id) on delete cascade,
  source_extension text not null,
  source_label text not null,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists plant_phone_calls_room_idx on public.plant_phone_calls(room_code, created_at desc);
create index if not exists plant_phone_call_messages_call_idx on public.plant_phone_call_messages(call_id, id);
alter table public.plant_phone_calls enable row level security;
alter table public.plant_phone_call_messages enable row level security;
drop policy if exists "authenticated private calls read" on public.plant_phone_calls;
drop policy if exists "authenticated private calls insert" on public.plant_phone_calls;
drop policy if exists "authenticated private calls update" on public.plant_phone_calls;
drop policy if exists "authenticated private call messages read" on public.plant_phone_call_messages;
drop policy if exists "authenticated private call messages insert" on public.plant_phone_call_messages;
create policy "authenticated private calls read" on public.plant_phone_calls for select to authenticated using (true);
create policy "authenticated private calls insert" on public.plant_phone_calls for insert to authenticated with check (true);
create policy "authenticated private calls update" on public.plant_phone_calls for update to authenticated using (true) with check (true);
create policy "authenticated private call messages read" on public.plant_phone_call_messages for select to authenticated using (true);
create policy "authenticated private call messages insert" on public.plant_phone_call_messages for insert to authenticated with check (true);
grant select, insert, update on public.plant_phone_calls to authenticated;
grant select, insert on public.plant_phone_call_messages to authenticated;
