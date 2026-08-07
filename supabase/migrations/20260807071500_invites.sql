-- Per-member invites: the only way a second device ever joins a group.
--
-- One invite names one member. That is the whole design: the code carries who
-- you are, so redeeming it binds the joining device to that named slot with no
-- picker and no chance of claiming the wrong person. It is why redemption can
-- be allowed after the group has expenses while This-is-me still cannot — the
-- target was fixed when the code was minted, so nothing is being moved.
--
-- Only the hash is stored, exactly as with access_tokens: a leaked database
-- dump must not be a pile of working invites.

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id),
  member_id uuid not null references public.members (id),
  code_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by_device_user_id text
);

create index invites_group_id_idx on public.invites (group_id);
create index invites_member_id_idx on public.invites (member_id);

-- An invite may only ever be spent once. The redeem path claims it with a
-- conditional update on redeemed_at and checks the row count, so two taps
-- racing on a flaky connection cannot both win; this pairs the redeemer with
-- the moment for anything auditing later.
alter table public.invites
  add constraint invites_redeemed_together
  check (
    (redeemed_at is null and redeemed_by_device_user_id is null)
    or (redeemed_at is not null and redeemed_by_device_user_id is not null)
  );

alter table public.invites enable row level security;

create policy invites_deny_all on public.invites
  for all to anon, authenticated
  using (false)
  with check (false);
