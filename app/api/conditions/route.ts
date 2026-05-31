import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// POST /api/conditions
// Body: { studyId, label, course_url, internal_notes, display_order }
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const supabase = createServiceClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { studyId, label, course_url, internal_notes, display_order } = await req.json()

  // Verify the study exists
  const { data: study } = await supabase
    .from('studies')
    .select('id')
    .eq('id', studyId)
    .single()

  if (!study) return NextResponse.json({ error: 'Study not found' }, { status: 404 })

  // Ensure researcher has a membership row — auto-creates it if missing
  // (can happen for studies created before the study_researchers migration)
  await supabase.from('study_researchers').upsert(
    { study_id: studyId, researcher_id: user.id, role: 'owner' },
    { onConflict: 'study_id,researcher_id' }
  )

  const { data: condition, error } = await supabase
    .from('conditions')
    .insert({ study_id: studyId, label, course_url, internal_notes, display_order })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ condition })
}

// DELETE /api/conditions?id=xxx
export async function DELETE(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const supabase = createServiceClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conditionId = req.nextUrl.searchParams.get('id')
  if (!conditionId) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // Verify ownership via study_researchers
  const { data: condition } = await supabase
    .from('conditions')
    .select('study_id')
    .eq('id', conditionId)
    .single()

  if (!condition) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await supabase.from('study_researchers').upsert(
    { study_id: condition.study_id, researcher_id: user.id, role: 'owner' },
    { onConflict: 'study_id,researcher_id' }
  )

  const { error } = await supabase.from('conditions').delete().eq('id', conditionId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
