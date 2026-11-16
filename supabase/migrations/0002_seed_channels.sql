-- Providence Academy channel structure.
--
-- Athletics is deliberately absent: it has its own app and keeps it. The
-- school app links out from the resource hub rather than mirroring it.
--
-- Grade-to-division mapping follows the classical model:
--   Grammar  K-6
--   Logic    7-8
--   Rhetoric 9-12

insert into channels (slug, name, kind, division, grade, restricted_posting, auto_join, sort_order, description) values
  ('all-campus',  'All-Campus',  'feed', 'all_campus', null, true, true, 0,  'News for the whole Providence community.'),
  ('grammar',     'Grammar',     'feed', 'grammar',    null, true, true, 10, 'Grammar School news and announcements.'),
  ('logic',       'Logic',       'feed', 'logic',      null, true, true, 20, 'Logic School news and announcements.'),
  ('rhetoric',    'Rhetoric',    'feed', 'rhetoric',   null, true, true, 30, 'Rhetoric School news and announcements.'),
  ('fine-arts',   'Fine Arts',   'feed', 'fine_arts',  null, true, false, 40, 'Fine arts performances, rehearsals and news.'),
  ('staff',       'Staff',       'feed', 'staff',      null, true, true, 50, 'Faculty and staff announcements.'),
  ('staff-lounge','Staff Lounge','group','staff',      null, false, true, 51, 'Open conversation among faculty and staff.');

-- Grade-level parent channels, K through 12.
insert into channels (slug, name, kind, division, grade, restricted_posting, auto_join, sort_order, description)
select
  'grade-' || lower(g.grade),
  case when g.grade = 'K' then 'Kindergarten Parents' else 'Grade ' || g.grade || ' Parents' end,
  'group',
  g.div::division,
  g.grade,
  false,   -- parents may post
  true,
  100 + g.ord,
  'Parent conversation for this grade level.'
from (values
  ('K',  'grammar',  0),
  ('1',  'grammar',  1),
  ('2',  'grammar',  2),
  ('3',  'grammar',  3),
  ('4',  'grammar',  4),
  ('5',  'grammar',  5),
  ('6',  'grammar',  6),
  ('7',  'logic',    7),
  ('8',  'logic',    8),
  ('9',  'rhetoric', 9),
  ('10', 'rhetoric', 10),
  ('11', 'rhetoric', 11),
  ('12', 'rhetoric', 12)
) as g(grade, div, ord);

-- A starter resource hub. The athletics link is how athletics stays present
-- in the app without being rebuilt inside it.
insert into resources (title, description, url, category, sort_order) values
  ('Athletics App', 'Schedules, scores and team news live in the Providence Athletics app.', '', 'Quick Links', 0),
  ('FACTS Family Portal', 'Tuition, payments and registration.', '', 'Quick Links', 1),
  ('Parent Handbook', 'Policies, expectations and school procedures.', '', 'Handbooks', 10),
  ('Student Handbook', 'Expectations and conduct for students.', '', 'Handbooks', 11),
  ('Bell Schedules', 'Daily schedules by division.', '', 'Schedules', 20),
  ('Lunch Menu', 'This month''s lunch menu.', '', 'Schedules', 21),
  ('Supply Lists', 'Grade-level supply lists.', '', 'Schedules', 22),
  ('Campus Maps', 'Grammar and Upper campus maps.', '', 'Campus', 30);
