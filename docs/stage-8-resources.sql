-- Run once in Supabase SQL Editor. No existing notes are modified.
begin;
create table if not exists public.vault_instructors (
  user_id uuid primary key
);
create table if not exists public.vault_announcements (
  id bigint generated always as identity primary key,
  note_id uuid not null unique default gen_random_uuid(),
  owner_id uuid not null,
  title text not null check (char_length(title) between 1 and 120),
  content text not null check (char_length(content) between 1 and 5000)
);
alter table public.vault_instructors enable row level security;
alter table public.vault_announcements enable row level security;
revoke all on table public.vault_instructors, public.vault_announcements from public, anon, authenticated;
grant select on public.vault_instructors to service_role;
grant select, insert, update, delete on public.vault_announcements to service_role;
grant usage on sequence public.vault_announcements_id_seq to service_role;
commit;
-- Instructor grants must be entered by the administrator in SQL Editor only.
-- Do not grant a student or judge account instructor status for a test.
