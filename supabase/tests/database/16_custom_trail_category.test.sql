-- =============================================================================
-- Database tests: your own trail category (category 'other' + custom_category).
--
-- Checks that save_trail keeps a typed category for 'other', drops it for the
-- usual categories, won't publish 'other' without a name, rejects names over 30
-- characters, and that the table never stores a custom name on another category.
-- Rolled back, so it leaves no data.
--
-- Run locally with Docker: npm run test:db. Runs in CI on every PR.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'maker@test.dev');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

create temporary table t (id uuid);
insert into t select public.save_trail('{"title": "Rooftop crawl", "status": "published", "category": "other", "custom_category": "  Rooftops  ",
  "stops": [{"place_name": "A"}, {"place_name": "B"}]}'::jsonb);

select is((select custom_category from public.sidequests where id = (select id from t)), 'Rooftops',
  'a typed category is saved (trimmed) when the category is other');

select public.save_trail('{"title": "Rooftop crawl", "status": "published", "category": "food_drink", "custom_category": "Rooftops",
  "stops": [{"place_name": "A"}, {"place_name": "B"}]}'::jsonb, (select id from t));
select is((select custom_category from public.sidequests where id = (select id from t)), null,
  'switching to a usual category drops the typed name');

select throws_ok($$select public.save_trail('{"title": "X", "status": "published", "category": "other",
  "stops": [{"place_name": "A"}, {"place_name": "B"}]}'::jsonb)$$,
  '23514', 'Type your own category before publishing', 'other needs a typed name to publish');

select lives_ok($$select public.save_trail('{"title": "X", "status": "draft", "category": "other"}'::jsonb)$$,
  'a draft can be other without a name yet');

select throws_ok($$select public.save_trail('{"title": "X", "status": "draft", "category": "other",
  "custom_category": "This category name is far too long to fit"}'::jsonb)$$,
  '23514', 'Keep your category to 30 characters', 'names over 30 characters are refused');

reset role;
select throws_ok($$insert into public.sidequests (creator_id, title, category, custom_category)
  values ('11111111-1111-1111-1111-111111111111', 'Y', 'outdoors', 'Nope')$$,
  '23514', null, 'a custom name only goes with category other');

select * from finish();
rollback;
