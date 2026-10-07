-- 5단계: public.vault_notes의 브라우저 직접 Data API 권한을 회수합니다.
-- Supabase SQL Editor에서 검토한 뒤 실행하세요. 다른 테이블은 변경하지 않습니다.

begin;

-- 적용 전 확인
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'vault_notes'
  and grantee in ('public', 'anon', 'authenticated', 'service_role')
order by grantee, privilege_type;

revoke all on table public.vault_notes from public, anon, authenticated;

commit;

-- 적용 후 확인: anon·authenticated는 모두 false, service_role 권한은 유지되어야 합니다.
select
  has_table_privilege('anon', 'public.vault_notes', 'select') as anon_can_select,
  has_table_privilege('anon', 'public.vault_notes', 'insert') as anon_can_insert,
  has_table_privilege('anon', 'public.vault_notes', 'update') as anon_can_update,
  has_table_privilege('anon', 'public.vault_notes', 'delete') as anon_can_delete,
  has_table_privilege('authenticated', 'public.vault_notes', 'select') as authenticated_can_select,
  has_table_privilege('authenticated', 'public.vault_notes', 'insert') as authenticated_can_insert,
  has_table_privilege('authenticated', 'public.vault_notes', 'update') as authenticated_can_update,
  has_table_privilege('authenticated', 'public.vault_notes', 'delete') as authenticated_can_delete,
  has_table_privilege('service_role', 'public.vault_notes', 'select') as service_role_can_select;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'vault_notes'
  and grantee in ('public', 'anon', 'authenticated', 'service_role')
order by grantee, privilege_type;
