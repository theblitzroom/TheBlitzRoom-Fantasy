create table if not exists public.profiles (
  id uuid primary key,
  email text,
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id bigserial primary key,
  profile_id uuid references public.profiles(id) on delete set null,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  stripe_price_id text,
  plan text not null default 'preview',
  status text not null,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_customer_idx
  on public.subscriptions(stripe_customer_id);

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can read their own subscriptions"
  on public.subscriptions for select
  using (
    profile_id = auth.uid()
    or stripe_customer_id in (
      select stripe_customer_id from public.profiles where id = auth.uid()
    )
  );
