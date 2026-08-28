-- Unit terminal responses are retained with the queued command so the
-- Supervisor console can show delivery and command output across browsers.
alter table public.plant_remote_commands
  add column if not exists completed_at timestamptz,
  add column if not exists result text;
