create extension if not exists pgcrypto;

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  location text not null,
  temperature text not null,
  tier text not null default 'C' check (tier in ('A', 'B', 'C', 'D')),
  phone text,
  email text,
  next_follow_up timestamp not null,
  last_contacted timestamp not null,
  notes jsonb not null default '[]'::jsonb,
  created_at timestamp default now(),
  -- additional fields to preserve current UI behavior
  social text,
  pipeline text not null,
  stage text not null
);

alter table public.contacts
add column if not exists tier text default 'C';

update public.contacts
set tier = 'C'
where tier is null;

alter table public.contacts
alter column tier set default 'C';

alter table public.contacts
alter column tier set not null;

alter table public.contacts disable row level security;
