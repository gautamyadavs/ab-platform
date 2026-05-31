import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// POST /api/enroll
// Body: { studyId, email }
// Returns: { participantId, studentId, conditionId, alreadyEnrolled }
export async function POST(req: NextRequest) {
  const { studyId, email } = await req.json()
  if (!studyId || !email) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const supabase = createServiceClient()

  // Check if study is active
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
    .select('id, student_id, condition_id')
    .eq('study_id', studyId)
    .eq('email', email.toLowerCase().trim())
    .single()

  if (existing) {
    return NextResponse.json({
      participantId: existing.id,
      studentId: existing.student_id,
      conditionId: existing.condition_id,
      alreadyEnrolled: true
    })
  }

  // Balanced random assignment via DB function
  const { data: conditionId, error: rpcError } = await supabase
    .rpc('assign_condition', { p_study_id: studyId })

  if (rpcError) {
    return NextResponse.json({ error: `Assignment error: ${rpcError.message}` }, { status: 500 })
  }

  if (!conditionId) {
    return NextResponse.json({ error: 'No conditions configured for this study. Add at least one condition in the researcher dashboard.' }, { status: 500 })
  }

  // Create participant row
  const { data: participant, error } = await supabase
    .from('participants')
    .insert({
      study_id: studyId,
      condition_id: conditionId,
      email: email.toLowerCase().trim()
    })
    .select('id, student_id, condition_id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    participantId: participant.id,
    studentId: participant.student_id,
    conditionId: participant.condition_id,
    alreadyEnrolled: false
  })
}
