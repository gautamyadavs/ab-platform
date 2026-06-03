-- ============================================================
-- Migration: Add background check screening to studies
-- Run this in your Supabase SQL editor
-- ============================================================

-- Add background check flag to studies
alter table studies
  add column if not exists has_background_check boolean not null default false;

-- ============================================================
-- BACKGROUND CHECK QUESTIONS
-- Study-level screening questions with correct answers.
-- Students must answer all questions correctly to proceed.
-- ============================================================
create table if not exists background_check_questions (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references studies(id) on delete cascade,
  question_text text not null,
  question_type text not null check (question_type in ('multiple_choice','checkbox','likert','short_text')),
  options_json jsonb,
  correct_answer text not null default '',
  order_index int default 0,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table background_check_questions enable row level security;

-- Researchers on the study can manage its background check questions
create policy "bcq_researcher_manage" on background_check_questions
  for all using (
    exists (
      select 1 from study_researchers sr
      where sr.study_id = background_check_questions.study_id
        and sr.researcher_id = auth.uid()
    )
  );

-- Public can read (student portal needs to fetch questions for screening)
create policy "bcq_public_read" on background_check_questions
  for select using (true);
