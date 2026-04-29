create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists push_subscriptions_user_id_idx
on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users can read own push subscriptions" on public.push_subscriptions;
create policy "Users can read own push subscriptions"
on public.push_subscriptions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own push subscriptions" on public.push_subscriptions;
create policy "Users can insert own push subscriptions"
on public.push_subscriptions
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own push subscriptions" on public.push_subscriptions;
create policy "Users can delete own push subscriptions"
on public.push_subscriptions
for delete
to authenticated
using (auth.uid() = user_id);

create table if not exists public.user_notification_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_notification_date date,
  updated_at timestamp with time zone not null default now()
);

alter table public.user_notification_state enable row level security;

drop policy if exists "Users can read own notification state" on public.user_notification_state;
create policy "Users can read own notification state"
on public.user_notification_state
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own notification state" on public.user_notification_state;
create policy "Users can insert own notification state"
on public.user_notification_state
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own notification state" on public.user_notification_state;
create policy "Users can update own notification state"
on public.user_notification_state
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
