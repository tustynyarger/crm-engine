alter table public.contacts
add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists contacts_user_id_idx on public.contacts(user_id);

alter table public.contacts enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'contacts_user_id_not_null'
  ) then
    alter table public.contacts
    add constraint contacts_user_id_not_null
    check (user_id is not null)
    not valid;
  end if;
end $$;

drop policy if exists "Users can read own contacts" on public.contacts;
create policy "Users can read own contacts"
on public.contacts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own contacts" on public.contacts;
create policy "Users can insert own contacts"
on public.contacts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own contacts" on public.contacts;
create policy "Users can update own contacts"
on public.contacts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own contacts" on public.contacts;
create policy "Users can delete own contacts"
on public.contacts
for delete
to authenticated
using (auth.uid() = user_id);
