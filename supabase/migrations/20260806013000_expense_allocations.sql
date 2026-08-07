-- Who owes, and how much, for each expense.
--
-- Allocations live inside the expense row rather than in their own table: the
-- split has no lifetime of its own and must sum to the expense total, and this
-- app merges per entity version. Child rows would let a device accept a new
-- amount while rejecting one of its shares, leaving a split that does not add
-- up and no version to blame. One row, one version, one atomic split.
alter table public.expenses
  add column if not exists allocations jsonb not null default '[]'::jsonb;

-- Shape guard only: the sum-to-total rule lives in the client domain, since
-- the server never recomputes a split it did not author.
alter table public.expenses
  drop constraint if exists expenses_allocations_is_array;
alter table public.expenses
  add constraint expenses_allocations_is_array
  check (jsonb_typeof(allocations) = 'array');
