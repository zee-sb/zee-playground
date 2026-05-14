-- Tenant-scope companion conversations.
--
-- Before this migration, `conversations` was keyed only on `user_id` — so the
-- Companion sidebar mixed chats across every workspace the user had ever
-- selected in the gallery tenant picker. Adding `staffbase_branch_id` lets
-- the list endpoint filter by the currently-active tenant and the chat path
-- stamp the originating workspace so a conversation can't drift between
-- tenants mid-flow.
--
-- Backfill: existing rows get the first registered tenant (by created_at) if
-- one exists. Single-tenant deployments are unaffected; multi-tenant
-- deployments will see all legacy conversations attached to whichever
-- workspace was registered first, which is the same behaviour they had
-- implicitly via `resolveBranchId`'s "only tenant" fallback.

alter table conversations
  add column if not exists staffbase_branch_id text;

do $$
declare
  default_branch text;
begin
  if exists (select 1 from information_schema.tables where table_name = 'staffbase_tenants') then
    select branch_id into default_branch
      from staffbase_tenants
      order by created_at asc
      limit 1;
    if default_branch is not null then
      update conversations
        set staffbase_branch_id = default_branch
        where staffbase_branch_id is null;
    end if;
  end if;
end $$;

create index if not exists conversations_branch_user_updated_idx
  on conversations (staffbase_branch_id, user_id, updated_at desc);
