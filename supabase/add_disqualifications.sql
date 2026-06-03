-- ============================================================
-- Migration: Track students disqualified by background check
-- Run this in your Supabase SQL editor
-- ============================================================

create table if not exists study_disqualifications (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references studies(id) on delete cascade,
  student_email text not null,
  disqualified_at timestamptz default now(),
  unique(study_id, student_email)
);

alter table study_disqualifications enable row level security;

-- Allow insert (student flow saves disqualification on failure)
create policy "disqualifications_insert" on study_disqualifications
  for insert with check (true);

-- Allow select (portal and course page filter by email)
create policy "disqualifications_select" on study_disqualifications
  for select using (true);

-- Researchers on the study can read disqualifications for analysis
create policy "disqualifications_researcher_read" on study_disqualifications
  for select using (
    exists (
      select 1 from study_researchers sr
      where sr.study_id = study_disqualifications.study_id
        and sr.researcher_id = auth.uid()
    )
  );
