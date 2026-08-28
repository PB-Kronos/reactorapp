-- PMS keeps urgent messages visibly active until an operator acknowledges them.
alter table public.plant_phone_messages
  add column if not exists priority text not null default 'normal' check (priority in ('normal', 'urgent')),
  add column if not exists acknowledged_at timestamptz;

drop policy if exists "authenticated plant phone update" on public.plant_phone_messages;
create policy "authenticated plant phone update" on public.plant_phone_messages
  for update to authenticated using (true) with check (true);
grant update on public.plant_phone_messages to authenticated;
