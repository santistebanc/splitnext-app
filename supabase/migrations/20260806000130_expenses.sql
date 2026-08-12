-- Expenses: who paid, how much, for what. Who *owes* is not modelled here;
-- allocations arrive with balances in the next slice.
create table if not exists public.expenses (
  id uuid primary key,
  group_id uuid not null references public.groups (id),
  payer_member_id uuid not null,
  amount_cents bigint not null check (amount_cents > 0),
  description text not null default '',
  version integer not null check (version > 0),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- the payer must be a member of the same group, as a bind's member must be
  constraint expenses_payer_in_group
    foreign key (payer_member_id, group_id)
    references public.members (id, group_id)
    on delete restrict
);

create index if not exists expenses_group_idx on public.expenses (group_id);

-- Clients never reach Postgres; Edge Functions use the service role.
alter table public.expenses enable row level security;
