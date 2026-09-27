-- Stripe Connect sample data for VOW.
-- Store platform-side mappings only; never store Stripe secret keys here.

create table if not exists public.stripe_connected_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  stripe_account_id text not null unique,
  last_requirement_event_id text,
  last_requirement_event_type text,
  last_requirement_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stripe_connect_products (
  id uuid primary key default gen_random_uuid(),
  stripe_product_id text not null unique,
  stripe_price_id text,
  connected_account_id text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  price_in_cents integer not null check (price_in_cents > 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.stripe_connected_accounts enable row level security;
alter table public.stripe_connect_products enable row level security;

create policy "Users can read their own Stripe Connect account"
  on public.stripe_connected_accounts for select to authenticated
  using (user_id = auth.uid());

create policy "Anyone can view active Stripe Connect products"
  on public.stripe_connect_products for select to anon, authenticated
  using (active = true);

create index if not exists stripe_connect_products_connected_account_idx
  on public.stripe_connect_products(connected_account_id);

create index if not exists stripe_connect_products_created_by_idx
  on public.stripe_connect_products(created_by);

create or replace function public.set_stripe_connect_updated_at()
returns trigger language plpgsql security invoker as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists stripe_connected_accounts_updated_at on public.stripe_connected_accounts;
create trigger stripe_connected_accounts_updated_at
before update on public.stripe_connected_accounts
for each row execute function public.set_stripe_connect_updated_at();

revoke all on public.stripe_connected_accounts from anon;
revoke all on public.stripe_connected_accounts from authenticated;
grant select on public.stripe_connected_accounts to authenticated;

revoke all on public.stripe_connect_products from anon;
revoke all on public.stripe_connect_products from authenticated;
grant select on public.stripe_connect_products to anon, authenticated;
