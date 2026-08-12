-- Members (name-slots) and binds (device_user ↔ member). Deny-all RLS.

create table public.members (
  id uuid primary key,
  group_id uuid not null references public.groups (id),
  version integer not null check (version >= 0),
  updated_at timestamptz not null,
  deleted_at timestamptz,
  display_name text not null default ''
);

create index members_group_id_idx on public.members (group_id);

create table public.binds (
  id uuid primary key,
  group_id uuid not null references public.groups (id),
  device_user_id text not null,
  member_id uuid not null references public.members (id),
  version integer not null check (version >= 0),
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create index binds_group_id_idx on public.binds (group_id);
create index binds_member_id_idx on public.binds (member_id);

-- One active bind per device per group (D-011 / slice 0003).
create unique index binds_one_active_per_device
  on public.binds (group_id, device_user_id)
  where deleted_at is null;

alter table public.members enable row level security;
alter table public.binds enable row level security;

create policy members_deny_all on public.members
  for all to anon, authenticated
  using (false)
  with check (false);

create policy binds_deny_all on public.binds
  for all to anon, authenticated
  using (false)
  with check (false);
