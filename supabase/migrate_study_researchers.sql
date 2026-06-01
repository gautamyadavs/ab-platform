-- ============================================================
-- Migration: replace studies.researcher_id with study_researchers
-- Run this in Supabase -> SQL Editor
-- ============================================================

-- 1. Create the junction table
create table if not exists study_researchers (
  study_id       uuid not null references studies(id) on delete cascade,
  researcher_id uuid not null references researchers(id) on delete cascade,
  role          text not null default 'owner' check (role in ('owner', 'collaborator')),
  created_at    timestamptz default now(),
  primary key (study_id, researcher_id)
);

alter table study_researchers enable row level security;

drop policy if exists "study_researchers_member" on study_researchers;

create policy "study_researchers_member"
on study_researchers
for all
using (researcher_id = auth.uid());


-- 2. Migrate existing study ownership, only if studies.researcher_id still exists
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'studies'
      and column_name = 'researcher_id'
  ) then
    insert into study_researchers (study_id, researcher_id, role)
    select id, researcher_id, 'owner'
    from studies
    where researcher_id is not null
    on conflict do nothing;
  end if;
end $$;


-- 3. Drop researcher_id from studies, if it still exists
alter table studies drop column if exists researcher_id cascade;


-- 4. Update studies policies
drop policy if exists "studies_owner" on studies;
drop policy if exists "studies_member" on studies;

create policy "studies_member"
on studies
for all
using (
  exists (
    select 1
    from study_researchers sr
    where sr.study_id = studies.id
      and sr.researcher_id = auth.uid()
  )
);


-- 5. Update conditions policies
drop policy if exists "conditions_owner" on conditions;

create policy "conditions_owner"
on conditions
for all
using (
  exists (
    select 1
    from study_researchers sr
    where sr.study_id = conditions.study_id
      and sr.researcher_id = auth.uid()
  )
);


-- 6. Update survey_questions policies
drop policy if exists "survey_questions_owner" on survey_questions;

create policy "survey_questions_owner"
on survey_questions
for all
using (
  exists (
    select 1
    from conditions c
    join study_researchers sr on sr.study_id = c.study_id
    where c.id = survey_questions.condition_id
      and sr.researcher_id = auth.uid()
  )
);


-- 7. Update participants policies
drop policy if exists "participants_researcher_read" on participants;

create policy "participants_researcher_read"
on participants
for select
using (
  exists (
    select 1
    from study_researchers sr
    where sr.study_id = participants.study_id
      and sr.researcher_id = auth.uid()
  )
);


-- 8. Update demographic_responses policies
drop policy if exists "demographics_researcher_read" on demographic_responses;

create policy "demographics_researcher_read"
on demographic_responses
for select
using (
  exists (
    select 1
    from participants p
    join study_researchers sr on sr.study_id = p.study_id
    where p.id = demographic_responses.participant_id
      and sr.researcher_id = auth.uid()
  )
);


-- 9. Update survey_responses policies
drop policy if exists "survey_responses_researcher_read" on survey_responses;

create policy "survey_responses_researcher_read"
on survey_responses
for select
using (
  exists (
    select 1
    from participants p
    join study_researchers sr on sr.study_id = p.study_id
    where p.id = survey_responses.participant_id
      and sr.researcher_id = auth.uid()
  )
);
