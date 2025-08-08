-- Add UUID identifiers for posts and migrate references in comments and votes
-- Safe to run multiple times

-- Enable UUID generation
create extension if not exists pgcrypto;

-- 1) Posts: add uid and backfill
alter table public.posts add column if not exists uid uuid;

update public.posts
set uid = coalesce(uid, gen_random_uuid())
where uid is null;

alter table public.posts
  alter column uid set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'posts_uid_key'
  ) then
    alter table public.posts add constraint posts_uid_key unique (uid);
  end if;
end $$;

create index if not exists posts_uid_idx on public.posts (uid);

-- 2) Comments: add post_uid and backfill + FK
alter table public.comments add column if not exists post_uid uuid;

update public.comments c
set post_uid = p.uid
from public.posts p
where c.post_uid is null and c.post_id = p.id;

alter table public.comments
  alter column post_uid set not null;

-- Drop old FK on post_id if it exists to avoid dual-FK ambiguity
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'comments_post_id_fkey'
  ) then
    alter table public.comments drop constraint comments_post_id_fkey;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'comments_post_uid_fkey'
  ) then
    alter table public.comments
      add constraint comments_post_uid_fkey foreign key (post_uid)
      references public.posts (uid) on delete cascade;
  end if;
end $$;

create index if not exists comments_post_uid_idx on public.comments (post_uid);

-- 3) Votes: add post_uid and backfill + FK
alter table public.votes add column if not exists post_uid uuid;

update public.votes v
set post_uid = p.uid
from public.posts p
where v.post_uid is null and v.post_id = p.id;

alter table public.votes
  alter column post_uid set not null;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'votes_post_id_fkey'
  ) then
    alter table public.votes drop constraint votes_post_id_fkey;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'votes_post_uid_fkey'
  ) then
    alter table public.votes
      add constraint votes_post_uid_fkey foreign key (post_uid)
      references public.posts (uid) on delete cascade;
  end if;
end $$;

create index if not exists votes_post_uid_idx on public.votes (post_uid);

-- Note: legacy numeric columns (posts.id, comments.post_id, votes.post_id) are retained
-- for backward compatibility and for existing RPCs that operate on numeric ids.
-- New application code should reference posts.uid, comments.post_uid, votes.post_uid.


