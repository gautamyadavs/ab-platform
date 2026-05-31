import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// GET /api/student?email=xxx
// Returns all course enrollments for a given student email
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')?.toLowerCase().trim()
  if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 })

  const supabase = createServiceClient()

  const { data: participants, error } = await supabase
    .from('participants')
    .select(`
      id,
      study_id,
      condition_id,
      consent_given_at,
      completed_pre_survey,
      completed_course,
      completed_post_survey,
      created_at,
      studies(id, title, description, status),
      conditions(label, course_url)
    `)
    .eq('email', email)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const courses = (participants || []).map((p: any) => ({
    participantId: p.id,
    studyId: p.study_id,
    studyTitle: p.studies?.title || '',
    studyDescription: p.studies?.description || '',
    studyStatus: p.studies?.status || '',
    conditionLabel: p.conditions?.label || '',
    consentGiven: !!p.consent_given_at,
    completedPreSurvey: p.completed_pre_survey,
    completedCourse: p.completed_course,
    completedPostSurvey: p.completed_post_survey,
    enrolledAt: p.created_at,
  }))

  return NextResponse.json({ courses })
}
