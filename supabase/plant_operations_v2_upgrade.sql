-- Unit 2 shared-plant upgrade.
-- Run this in the Supabase SQL editor if plant_operations.sql was already run.
-- It is intentionally idempotent and preserves existing rooms and scores.

alter table public.plant_rooms
  add column if not exists next_plant_demand_mw numeric not null default 675
  check (next_plant_demand_mw >= 0 and next_plant_demand_mw <= 2400);
alter table public.plant_rooms
  add column if not exists demand_effective_at timestamptz;
alter table public.plant_rooms
  add column if not exists demand_manager_last_seen timestamptz;
alter table public.plant_rooms
  add column if not exists interlock_source_unit smallint not null default 1
  check (interlock_source_unit in (1, 2));
alter table public.plant_rooms
  add column if not exists interlock_target_unit smallint not null default 2
  check (interlock_target_unit in (1, 2));
alter table public.plant_rooms
  add column if not exists interlock_breaker_closed boolean not null default false;
alter table public.plant_units
  add column if not exists bus_a_available boolean not null default false;
alter table public.plant_units
  add column if not exists bus_a_transformer_closed boolean not null default false;
alter table public.plant_stations
  add column if not exists session_id text;

alter table public.players
  add column if not exists points_unit1 numeric not null default 0;
alter table public.players
  add column if not exists points_unit2 numeric not null default 0;

create table if not exists public.plant_score_ticks (
  room_code text not null references public.plant_rooms(code) on delete cascade,
  unit_number smallint not null check (unit_number in (1, 2)),
  tick_bucket bigint not null,
  primary key (room_code, unit_number, tick_bucket)
);
alter table public.plant_score_ticks enable row level security;
grant select, insert on public.plant_score_ticks to anon, authenticated;
drop policy if exists "public simulator point ticks readable" on public.plant_score_ticks;
drop policy if exists "public simulator point ticks writable" on public.plant_score_ticks;
create policy "public simulator point ticks readable" on public.plant_score_ticks for select to anon, authenticated using (true);
create policy "public simulator point ticks writable" on public.plant_score_ticks for insert to anon, authenticated with check (true);
create or replace function public.claim_plant_unit_point_tick(room text, unit smallint, tick_bucket bigint)
returns boolean language plpgsql security invoker set search_path = public as $$
begin
  insert into public.plant_score_ticks (room_code, unit_number, tick_bucket)
  values (room, unit, tick_bucket)
  on conflict do nothing;
  return found;
end;
$$;
grant execute on function public.claim_plant_unit_point_tick(text, smallint, bigint) to anon, authenticated;
