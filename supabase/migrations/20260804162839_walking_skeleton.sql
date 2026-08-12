-- Walking skeleton: groups + per-device access tokens. Deny-all RLS for client roles.

create table public.groups (
  id uuid primary key,
  version integer not null check (version >= 0),
  updated_at timestamptz not null,
  deleted_at timestamptz,
  name text not null default '',
  currency_label text not null default 'EUR',
  is_closed boolean not null default false
);

create table public.access_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  group_id uuid not null references public.groups (id),
  device_user_id text not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index access_tokens_group_id_idx on public.access_tokens (group_id);
create index access_tokens_device_user_id_idx on public.access_tokens (device_user_id);

alter table public.groups enable row level security;
alter table public.access_tokens enable row level security;

-- Deny-all for client-facing roles. Service role bypasses RLS.
create policy groups_deny_all on public.groups
  for all to anon, authenticated
  using (false)
  with check (false);

create policy access_tokens_deny_all on public.access_tokens
  for all to anon, authenticated
  using (false)
  with check (false);
