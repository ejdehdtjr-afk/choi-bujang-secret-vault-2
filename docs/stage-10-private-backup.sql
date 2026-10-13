-- Supabase SQL Editor에서 시험 침해 전에 한 번 실행합니다.
-- 이 파일에는 메모 내용이나 키가 없습니다. 기존 감사 기록과 다른 테이블은 지우지 않습니다.
begin;

create schema if not exists vault_private;
revoke all on schema vault_private from public, anon, authenticated;
lock table public.vault_notes in share row exclusive mode;

create table if not exists vault_private.note_backups (
  note_id uuid primary key,
  owner_id uuid not null,
  title text not null,
  content text not null,
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  captured_at timestamptz not null default now()
);
create table if not exists vault_private.restore_audit (
  audit_id bigint generated always as identity primary key,
  note_id uuid not null,
  owner_id uuid not null,
  content_sha256 text not null,
  restored_at timestamptz not null default now()
);
alter table vault_private.note_backups enable row level security;
alter table vault_private.restore_audit enable row level security;
revoke all on table vault_private.note_backups, vault_private.restore_audit
  from public, anon, authenticated, service_role;

-- 현재 자료를 이 시점의 사본으로 고정합니다. 사본은 이후 수정/삭제로 덮어쓰지 않습니다.
insert into vault_private.note_backups
  (note_id, owner_id, title, content, content_sha256)
select note_id, owner_id, title, content,
       pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(title || E'\x1f' || content, 'UTF8')), 'hex')
from public.vault_notes
where note_id is not null and owner_id is not null
on conflict (note_id) do nothing;

create function vault_private.capture_note_backup()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into vault_private.note_backups
    (note_id, owner_id, title, content, content_sha256)
  values (new.note_id, new.owner_id, new.title, new.content,
          pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(new.title || E'\x1f' || new.content, 'UTF8')), 'hex'))
  on conflict (note_id) do nothing;
  return new;
end;
$$;
revoke all on function vault_private.capture_note_backup() from public, anon, authenticated;
create trigger vault_note_backup_on_insert
after insert on public.vault_notes
for each row execute function vault_private.capture_note_backup();

-- 비공개 사본의 동일 소유자 한 건만 INSERT 또는 UPDATE로 복원합니다.
-- 결과와 사본의 해시가 다르면 예외로 전체 트랜잭션을 취소합니다.
create function public.restore_vault_note(p_note_id uuid, p_owner_id uuid)
returns table (restored_note_id uuid, restored_owner_id uuid, restored_content_sha256 text)
language plpgsql security definer set search_path = '' as $$
declare
  backup vault_private.note_backups%rowtype;
  actual_hash text;
begin
  select * into backup from vault_private.note_backups b
    where b.note_id = p_note_id and b.owner_id = p_owner_id for share;
  if not found then return; end if;
  if backup.content_sha256 is distinct from
      pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(backup.title || E'\x1f' || backup.content, 'UTF8')), 'hex') then
    raise exception 'backup_hash_mismatch';
  end if;

  insert into public.vault_notes (note_id, owner_id, title, content)
    values (backup.note_id, backup.owner_id, backup.title, backup.content)
    on conflict (note_id) do update
      set title = excluded.title, content = excluded.content
      where public.vault_notes.owner_id = excluded.owner_id;
  if not found then return; end if;

  select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(n.title || E'\x1f' || n.content, 'UTF8')), 'hex')
    into actual_hash from public.vault_notes n
    where n.note_id = backup.note_id and n.owner_id = backup.owner_id;
  if actual_hash is distinct from backup.content_sha256 then
    raise exception 'restore_hash_mismatch';
  end if;

  insert into vault_private.restore_audit (note_id, owner_id, content_sha256)
    values (backup.note_id, backup.owner_id, actual_hash);
  return query select backup.note_id, backup.owner_id, actual_hash;
end;
$$;
revoke all on function public.restore_vault_note(uuid, uuid) from public, anon, authenticated;
grant execute on function public.restore_vault_note(uuid, uuid) to service_role;
commit;

-- 확인은 값이 아닌 건수와 권한만 표시합니다.
select (select count(*) from vault_private.note_backups) as backup_count,
       (select count(*) from public.vault_notes) as live_count,
       has_function_privilege('anon', 'public.restore_vault_note(uuid,uuid)', 'EXECUTE') as anon_can_restore,
       has_function_privilege('authenticated', 'public.restore_vault_note(uuid,uuid)', 'EXECUTE') as authenticated_can_restore,
       has_function_privilege('service_role', 'public.restore_vault_note(uuid,uuid)', 'EXECUTE') as service_can_restore;
