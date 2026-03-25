alter table public.contacts
add column if not exists tier text;

update public.contacts
set tier = 'C'
where tier is null;

alter table public.contacts
alter column tier set default 'C';

alter table public.contacts
alter column tier set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'contacts_tier_check'
  ) then
    alter table public.contacts
    add constraint contacts_tier_check
    check (tier in ('A', 'B', 'C', 'D'));
  end if;
end $$;
