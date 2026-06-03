import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

function csvCell(val: string | number | boolean | null | undefined): string {
  const s = String(val ?? '')
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

function checkMatch(
  response: string,
  expected: string,
  questionType: string
): boolean | null {
  if (!expected || questionType === 'short_text') return null

  if (questionType === 'multiple_choice') {
    // Student picks one answer; correct if it is in the set of correct answers
    const correctSet = new Set(expected.split('||').map(s => s.trim()).filter(Boolean))
    return correctSet.has(response.trim())
  }

  if (questionType === 'checkbox') {
    // Student picks multiple answers; correct if they match the exact expected set
    const r = new Set(response.split('||').map(s => s.trim()).filter(Boolean))
    const e = new Set(expected.split('||').map(s => s.trim()).filter(Boolean))
    if (r.size !== e.size) return false
    for (const item of e) if (!r.has(item)) return false
    return true
  }

  return response.trim() === expected.trim()
}

// GET /api/export-background-check?studyId=xxx&format=csv|json
// Requires researcher auth via bearer token
export async function GET(req: NextRequest) {
  const studyId = req.nextUrl.searchParams.get('studyId')
  const format = req.nextUrl.searchParams.get('format') === 'json' ? 'json' : 'csv'

  if (!studyId) return NextResponse.json({ error: 'Missing studyId' }, { status: 400 })

  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const supabase = createServiceClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify researcher membership
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

  // Fetch background check questions for this study
  const { data: questions } = await supabase
    .from('background_check_questions')
    .select('id, question_text, question_type, correct_answer, order_index')
    .eq('study_id', studyId)
    .order('order_index')

  if (!questions || questions.length === 0) {
    return NextResponse.json({ error: 'No background check questions found' }, { status: 404 })
  }

  // Fetch all participants in this study
  const { data: participants } = await supabase
    .from('participants')
    .select('id, email, created_at')
    .eq('study_id', studyId)
    .order('created_at')

  if (!participants) return NextResponse.json({ error: 'No participants' }, { status: 404 })

  // Fetch all BCQ responses
  const { data: responses } = await supabase
    .from('background_check_responses')
    .select('participant_id, question_id, response_value')
    .in('participant_id', participants.map(p => p.id))

  const slug = study.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()

  // ── JSON export ──────────────────────────────────────────────
  if (format === 'json') {
    const data = {
      study: study.title,
      exported_at: new Date().toISOString(),
      questions: questions.map(q => ({
        id: q.id,
        question_text: q.question_text,
        question_type: q.question_type,
        expected_answer: q.correct_answer || null
      })),
      responses: participants.map(p => ({
        email: p.email,
        enrolled_at: p.created_at,
        answers: questions.map(q => {
          const r = responses?.find(r => r.participant_id === p.id && r.question_id === q.id)
          const responseValue = r?.response_value ?? ''
          const matched = checkMatch(responseValue, q.correct_answer, q.question_type)
          return {
            question_id: q.id,
            question: q.question_text,
            question_type: q.question_type,
            response: responseValue,
            expected: q.correct_answer || null,
            matched
          }
        })
      }))
    }

    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${slug}_background_check.json"`
      }
    })
  }

  // ── CSV export ───────────────────────────────────────────────
  // Wide format: one row per participant, one column-pair per question
  const questionHeaders = questions.flatMap(q => [
    q.question_text,
    `${q.question_text} (Expected Answer)`,
    `${q.question_text} (Match)`
  ])

  const header = ['email', 'enrolled_at', ...questionHeaders].map(csvCell).join(',')

  const rows = participants.map(p => {
    const questionCells = questions.flatMap(q => {
      const r = responses?.find(r => r.participant_id === p.id && r.question_id === q.id)
      const responseValue = r?.response_value ?? ''
      const matched = checkMatch(responseValue, q.correct_answer, q.question_type)
      const matchLabel = matched === null ? 'N/A' : matched ? 'yes' : 'no'
      return [
        csvCell(responseValue),
        csvCell(q.correct_answer || ''),
        csvCell(matchLabel)
      ]
    })
    return [csvCell(p.email), csvCell(p.created_at), ...questionCells].join(',')
  })

  const csv = [header, ...rows].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${slug}_background_check.csv"`
    }
  })
}
