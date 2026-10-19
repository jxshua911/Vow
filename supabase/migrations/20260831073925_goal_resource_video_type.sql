alter table public.goal_resources drop constraint if exists goal_resources_resource_type_check;
alter table public.goal_resources add constraint goal_resources_resource_type_check check (resource_type in ('youtube','instagram','image','video','link'));
