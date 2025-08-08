-- Ensure new posts automatically receive a UUID
create extension if not exists pgcrypto;

alter table public.posts
  alter column uid set default gen_random_uuid();


