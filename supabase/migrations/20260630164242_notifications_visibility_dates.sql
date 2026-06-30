alter table public.notifications
  add column if not exists visible_from date,
  add column if not exists visible_to date;

drop policy if exists notifications_school_member_select on public.notifications;

create policy notifications_school_member_select
on public.notifications
for select
to authenticated
using (
  public.is_school_admin(school_id)
  or (
    (public.is_school_staff(school_id) or public.is_school_parent(school_id))
    and (visible_from is null or visible_from <= current_date)
    and (visible_to is null or visible_to >= current_date)
  )
);
