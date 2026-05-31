import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

interface ConditionInput {
  label: string
  course_url: string
  description: string
}

// POST /api/studies
// Body: { study: { title, description, consent_text, target_per_condition }, conditions: [...] }
// Requires researcher auth via bearer token
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const supabase = createServiceClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Ensure researcher row exists (may be missing if signup email confirmation was required)
  await supabase.from('researchers').upsert(
    { id: user.id, email: user.email!, full_name: user.user_metadata?.full_name ?? '' },
    { onConflict: 'id' }
  )

  const { study: studyInput, conditions: conditionsInput } = await req.json()

  const { data: study, error: studyErr } = await supabase
    .from('studies')
    .insert({
      title: studyInput.title,
      description: studyInput.description,
      consent_text: studyInput.consent_text,
      target_per_condition: studyInput.target_per_condition,
      status: 'draft'
    })
    .select()
    .single()

  if (studyErr || !study) {
    return NextResponse.json({ error: studyErr?.message || 'Failed to create study' }, { status: 500 })
  }

  // Add creator as owner in study_researchers
  const { error: srErr } = await supabase.from('study_researchers').insert({
    study_id: study.id,
    researcher_id: user.id,
    role: 'owner'
  })

  if (srErr) {
    return NextResponse.json({ error: srErr.message }, { status: 500 })
  }

  const validConditions: ConditionInput[] = (conditionsInput || []).filter(
    (c: ConditionInput) => c.label?.trim() && c.course_url?.trim()
  )

  if (validConditions.length > 0) {
    const { error: condErr } = await supabase.from('conditions').insert(
      validConditions.map((c, i) => ({
        study_id: study.id,
        label: c.label.trim(),
        course_url: c.course_url.trim(),
        internal_notes: c.description?.trim() || '',
        display_order: i
      }))
    )

    if (condErr) {
      return NextResponse.json({ error: condErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ study })
}
