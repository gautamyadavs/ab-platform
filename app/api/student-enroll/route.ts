import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

interface BCQAnswer {
  questionId: string
  responseValue: string
}

// POST /api/student-enroll
// Body: { studyId, bcqAnswers: [{questionId, responseValue}] }
// Auth: Bearer token (student JWT)
// Creates a participant row, saves consent, saves BCQ answers.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const supabase = createServiceClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = user.email!.toLowerCase().trim()

  // Ensure student row exists
  await supabase.from('students').upsert(
    { id: user.id, email, full_name: user.user_metadata?.full_name ?? '' },
    { onConflict: 'id' }
  )

  const { studyId, bcqAnswers } = await req.json()
  if (!studyId) return NextResponse.json({ error: 'Missing studyId' }, { status: 400 })

  // Verify study is active
  const { data: study } = await supabase
    .from('studies')
    .select('id, status')
    .eq('id', studyId)
    .single()

  if (!study || study.status !== 'active') {
    return NextResponse.json({ error: 'Study not available' }, { status: 404 })
  }

  // Check if already enrolled
  const { data: existing } = await supabase
    .from('participants')
    .select('id, condition_id')
    .eq('study_id', studyId)
    .eq('email', email)
    .single()

  if (existing) {
    return NextResponse.json({
      participantId: existing.id,
      conditionId: existing.condition_id,
      alreadyEnrolled: true
    })
  }

  // Balanced condition assignment
  const { data: conditionId, error: rpcError } = await supabase
    .rpc('assign_condition', { p_study_id: studyId })

  if (rpcError || !conditionId) {
    return NextResponse.json({ error: 'No conditions configured for this study.' }, { status: 500 })
  }

  // Create participant — consent is given at this point
  const { data: participant, error: partErr } = await supabase
    .from('participants')
    .insert({
      study_id: studyId,
      condition_id: conditionId,
      email,
      consent_given_at: new Date().toISOString()
    })
    .select('id, condition_id')
    .single()

  if (partErr || !participant) {
    return NextResponse.json({ error: partErr?.message || 'Enrollment failed' }, { status: 500 })
  }

  // Save background check answers
  if (Array.isArray(bcqAnswers) && bcqAnswers.length > 0) {
    await supabase.from('background_check_responses').insert(
      bcqAnswers.map((a: BCQAnswer) => ({
        participant_id: participant.id,
        question_id: a.questionId,
        response_value: a.responseValue
      }))
    )
  }

  return NextResponse.json({
    participantId: participant.id,
    conditionId: participant.condition_id,
    alreadyEnrolled: false
  })
}
