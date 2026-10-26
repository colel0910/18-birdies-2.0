-- RUN ONCE in the Supabase SQL Editor of project fyzixumgclwohjllqefs.
-- This keeps every signed-in user's course coordinates private.
create table if not exists public.golf_cloud_courses (
  user_id uuid not null references auth.users(id) on delete cascade,
  course_key text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, course_key),
  constraint golf_course_key_length check (char_length(course_key) between 1 and 150),
  constraint golf_course_data_object check (jsonb_typeof(data) = 'object')
);
alter table public.golf_cloud_courses enable row level security;
revoke all on public.golf_cloud_courses from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.golf_cloud_courses to authenticated;
drop policy if exists golf_cloud_select_self on public.golf_cloud_courses;
drop policy if exists golf_cloud_insert_self on public.golf_cloud_courses;
drop policy if exists golf_cloud_update_self on public.golf_cloud_courses;
drop policy if exists golf_cloud_delete_self on public.golf_cloud_courses;
create policy golf_cloud_select_self on public.golf_cloud_courses for select to authenticated using ((select auth.uid()) = user_id);
create policy golf_cloud_insert_self on public.golf_cloud_courses for insert to authenticated with check ((select auth.uid()) = user_id);
create policy golf_cloud_update_self on public.golf_cloud_courses for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy golf_cloud_delete_self on public.golf_cloud_courses for delete to authenticated using ((select auth.uid()) = user_id);
