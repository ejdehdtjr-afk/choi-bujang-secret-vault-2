-- 비밀값이나 실제 메모 본문을 출력하지 않는 재시험용 가상 한 건.
-- BEGIN에서 만든 메모·사본·감사 행은 마지막 ROLLBACK으로 모두 취소됩니다.
begin;
do $$
declare
  note_uuid uuid := pg_catalog.gen_random_uuid();
  owner_uuid uuid := pg_catalog.gen_random_uuid();
  restored record;
  expected_hash text;
begin
  expected_hash := pg_catalog.encode(pg_catalog.sha256(
    pg_catalog.convert_to('restore-fixture' || E'\x1f' || 'before', 'UTF8')), 'hex');
  insert into public.vault_notes (note_id, owner_id, title, content)
    values (note_uuid, owner_uuid, 'restore-fixture', 'before');

  update public.vault_notes set content = 'changed' where note_id = note_uuid;
  select * into restored from public.restore_vault_note(note_uuid, owner_uuid);
  if restored.restored_note_id is distinct from note_uuid
      or restored.restored_owner_id is distinct from owner_uuid
      or restored.restored_content_sha256 is distinct from expected_hash then
    raise exception 'update_restore_failed';
  end if;

  delete from public.vault_notes where note_id = note_uuid;
  select * into restored from public.restore_vault_note(note_uuid, owner_uuid);
  if restored.restored_note_id is distinct from note_uuid
      or restored.restored_owner_id is distinct from owner_uuid
      or restored.restored_content_sha256 is distinct from expected_hash then
    raise exception 'delete_restore_failed';
  end if;
end;
$$;
rollback;

select (select count(*) from vault_private.note_backups) as backup_count_after_rollback,
       (select count(*) from vault_private.restore_audit) as audit_count_after_rollback;
