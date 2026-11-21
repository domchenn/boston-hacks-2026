-- Seed data for LOCAL/dev and the demo project. Safe to re-run.
--
-- Profiles are created by the auth trigger, so sidequests (which need a
-- creator_id) are added after the "Breadcrumb Team" demo account exists.
-- Person D's content sheet (experiences + sidequests) will be converted here.

insert into public.communities (name, slug, university) values
  ('Boston University', 'bu', 'Boston University'),
  ('Boston College',    'bc', 'Boston College')
on conflict (slug) do nothing;
