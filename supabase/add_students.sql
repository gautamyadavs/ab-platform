-- ============================================================
-- Migration: Student accounts and background check responses
-- Run this in your Supabase SQL editor
-- ============================================================

-- ============================================================
-- STUDENTS
-- Mirrors the researchers table — one row per auth user
-- who registered as a learner.
-- ============================================================
create table if not exists students (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  created_at timestamptz default now()
);

-- ============================================================
-- BACKGROUND CHECK RESPONSES
-- Stores student answers to background_check_questions.
-- Saved at consent time alongside participant creation.
-- ============================================================
create table if not exists background_check_responses (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  question_id uuid not null references background_check_questions(id) on delete cascade,
  response_value text not null default '',
  created_at timestamptz default now(),
  unique(participant_id, question_id)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table students enable row level security;
alter table background_check_responses enable row level security;

-- Students manage their own profile
create policy "students_self" on students
  for all using (auth.uid() = id);

-- BCQ responses: open insert (student flow has no auth at insert time)
create policy "bcq_responses_insert" on background_check_responses
  for insert with check (true);

-- BCQ responses: researchers on the study can read
create policy "bcq_responses_researcher_read" on background_check_responses
  for select using (
    exists (
      select 1 from participants p
      join study_researchers sr on sr.study_id = p.study_id
      where p.id = background_check_responses.participant_id
        and sr.researcher_id = auth.uid()
    )
  );
