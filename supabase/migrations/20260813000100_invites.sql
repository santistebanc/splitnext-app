-- One-use, 7-day invites. A row names the member the joiner will bind to.
-- Not a merge entity: mint and redeem go through their own Edge Functions.

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  group_id uuid not null references public.groups (id),
  member_id uuid not null,
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.invites
  add constraint invites_member_same_group_fkey
  foreign key (member_id, group_id)
  references public.members (id, group_id);

create index invites_group_id_idx on public.invites (group_id);

alter table public.invites enable row level security;

create policy invites_deny_all on public.invites
  for all to anon, authenticated
  using (false)
  with check (false);
