import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// GET /api/export?studyId=xxx
// Returns CSV of all participant data for a study
// Requires researcher auth via bearer token
export async function GET(req: NextRequest) {
  const studyId = req.nextUrl.searchParams.get('studyId')
  if (!studyId) return NextResponse.json({ error: 'Missing studyId' }, { status: 400 })

  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const supabase = createServiceClient()

  // Verify the token belongs to the study owner
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: study } = await supabase
    .from('studies')
    .select('id, title')
    .eq('id', studyId)
    .single()

  const { data: membership } = await supabase
    .from('study_researchers')
    .select('role')
    .eq('study_id', studyId)
    .eq('researcher_id', user.id)
    .single()

  if (!study || !membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch all participants with demographics and conditions
  const { data: participants } = await supabase
    .from('participants')
    .select(`
      id, student_id, email, condition_id, consent_given_at,
      completed_pre_survey, completed_course, completed_post_survey, created_at,
      conditions(label),
      demographic_responses(age_range, gender, education_level, field_of_study, prior_experience)
    `)
    .eq('study_id', studyId)
    .order('created_at')

  if (!participants) return NextResponse.json({ error: 'No data' }, { status: 404 })

  // Fetch all survey questions and responses
  const { data: questions } = await supabase
    .from('survey_questions')
    .select('id, condition_id, survey_type, question_text, order_index')
    .in('condition_id', participants.map(p => p.condition_id).filter(Boolean))
    .order('survey_type')
    .order('order_index')

  const { data: responses } = await supabase
    .from('survey_responses')
    .select('participant_id, question_id, response_value')
    .in('participant_id', participants.map(p => p.id))

  // Build CSV
  const questionCols = questions?.map(q => `${q.survey_type}_q${q.order_index + 1}: ${q.question_text.slice(0, 30)}`) || []

  const header = [
    'student_id', 'email', 'condition', 'enrolled_at', 'consent_given',
    'pre_survey_done', 'course_done', 'post_survey_done',
    'age_range', 'gender', 'education_level', 'field_of_study', 'prior_experience',
    ...questionCols
  ]

  const rows = participants.map(p => {
    const demo = Array.isArray(p.demographic_responses) ? p.demographic_responses[0] : p.demographic_responses
    const condLabel = Array.isArray(p.conditions) ? p.conditions[0]?.label : (p.conditions as any)?.label

    const surveyVals = questions?.map(q => {
      const r = responses?.find(r => r.participant_id === p.id && r.question_id === q.id)
      return r ? `"${r.response_value.replace(/"/g, '""')}"` : ''
    }) || []

    return [
      p.student_id,
      p.email,
      condLabel || '',
      p.created_at,
      p.consent_given_at ? 'yes' : 'no',
      p.completed_pre_survey ? 'yes' : 'no',
      p.completed_course ? 'yes' : 'no',
      p.completed_post_survey ? 'yes' : 'no',
      demo?.age_range || '',
      demo?.gender || '',
      demo?.education_level || '',
      demo?.field_of_study || '',
      demo?.prior_experience || '',
      ...surveyVals
    ].join(',')
  })

  const csv = [header.join(','), ...rows].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${study.title.replace(/[^a-z0-9]/gi, '_')}_participants.csv"`
    }
  })
}
