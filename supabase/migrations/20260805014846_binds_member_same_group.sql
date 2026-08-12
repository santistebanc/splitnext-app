-- Bind.member_id must belong to the same group (composite FK).

create unique index members_id_group_id_uidx
  on public.members (id, group_id);

alter table public.binds
  add constraint binds_member_same_group_fkey
  foreign key (member_id, group_id)
  references public.members (id, group_id);
