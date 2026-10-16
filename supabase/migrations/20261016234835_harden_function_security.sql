-- Resolve Supabase security advisor warnings.
--
-- 1. set_updated_at: pin search_path so it can't be hijacked by a role's search_path.
-- 2. create_profile_for_new_auth_user / rls_auto_enable: these are trigger functions.
--    Triggers fire without the caller needing EXECUTE, so nobody needs to call them
--    through the API (/rest/v1/rpc/...). Revoke EXECUTE from API roles.
-- 3. current_user_is_admin: RLS policies need signed-in users to be able to run it,
--    so it moves to a non-exposed `private` schema. Policies keep working, but it can
--    no longer be called directly through the API.

-- 1. set_updated_at --------------------------------------------------------------
alter function public.set_updated_at() set search_path = '';

-- 2. Trigger-only functions ------------------------------------------------------
revoke execute on function public.create_profile_for_new_auth_user() from public, anon, authenticated;

do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;

-- 3. Admin check in a private schema --------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function private.current_user_is_admin() from public;
grant execute on function private.current_user_is_admin() to authenticated;

-- Repoint admin policies at the private function.
alter policy "Admins can manage songs" on public.songs
  using ((select private.current_user_is_admin()))
  with check ((select private.current_user_is_admin()));

alter policy "Admins can manage blog posts" on public.blog_posts
  using ((select private.current_user_is_admin()))
  with check ((select private.current_user_is_admin()));

alter policy "Admins can manage site content" on public.site_content
  using ((select private.current_user_is_admin()))
  with check ((select private.current_user_is_admin()));

alter policy "Admins can read all wave participation" on public.wave_participation_events
  using ((select private.current_user_is_admin()));

-- The old public.current_user_is_admin() is no longer referenced by any policy.
-- Revoke API access instead of dropping it, so nothing that might still call it errors.
revoke execute on function public.current_user_is_admin() from public, anon, authenticated;
