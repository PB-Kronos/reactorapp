-- Adds the shared diagnostic breaker for the Unit 1 ↔ Unit 2 Bus A tie.
alter table public.plant_rooms
  add column if not exists interlock_breaker_closed boolean not null default false;

