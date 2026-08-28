-- Explicit manager state prevents an open Supervisor page from immediately
-- re-enabling demand management after an operator has turned it off.
alter table public.plant_rooms
  add column if not exists demand_manager_enabled boolean not null default true;
