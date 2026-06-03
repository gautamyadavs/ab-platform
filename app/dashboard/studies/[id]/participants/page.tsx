'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface ParticipantRow {
  id: string
  student_id: string
  email: string
  condition_label: string
  created_at: string
  consent_given_at: string | null
  completed_pre_survey: boolean
  completed_course: boolean
  completed_post_survey: boolean
}

export default function ParticipantsPage() {
  const { id: studyId } = useParams<{ id: string }>()
  const [participants, setParticipants] = useState<ParticipantRow[]>([])
  const [conditions, setConditions] = useState<{ id: string; label: string }[]>([])
  const [filterCondition, setFilterCondition] = useState('all')
  const [studyTitle, setStudyTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [conditionCounts, setConditionCounts] = useState<Record<string, number>>({})

  useEffect(() => { load() }, [studyId])

  async function load() {
    const { data: study } = await supabase.from('studies').select('title').eq('id', studyId).single()
    setStudyTitle(study?.title || '')

    const { data: conds } = await supabase.from('conditions').select('id, label').eq('study_id', studyId).order('display_order')
    setConditions(conds || [])

    const { data } = await supabase
      .from('participants')
      .select(`
        id, student_id, email, created_at, consent_given_at,
        completed_pre_survey, completed_course, completed_post_survey,
        conditions(label)
      `)
      .eq('study_id', studyId)
      .order('created_at', { ascending: false })

    const rows: ParticipantRow[] = (data || []).map((p: any) => ({
      ...p,
      condition_label: Array.isArray(p.conditions) ? p.conditions[0]?.label : p.conditions?.label || '—'
    }))
    setParticipants(rows)

    // Count per condition
    const counts: Record<string, number> = {}
    rows.forEach(r => { counts[r.condition_label] = (counts[r.condition_label] || 0) + 1 })
    setConditionCounts(counts)
    setLoading(false)
  }

  async function handleExport() {
    setExporting(true)
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    const res = await fetch(`/api/export?studyId=${studyId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${studyTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_participants.csv`
    a.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  function maskEmail(email: string) {
    const [user, domain] = email.split('@')
    return user[0] + '***@' + domain
  }

  const filtered = filterCondition === 'all'
    ? participants
    : participants.filter(p => p.condition_label === filterCondition)

  return (
    <div className="max-w-5xl pb-20">
      <div className="flex items-center gap-2 text-sm text-slate-400 mb-6">
        <Link href="/dashboard" className="hover:text-blue-600">Studies</Link>
        <span>/</span>
        <span className="text-slate-600 font-medium">{studyTitle}</span>
        <span>/</span>
        <span className="text-slate-600">Participants</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Participants</h1>
          <p className="text-slate-500 text-sm mt-1">{participants.length} total enrolled</p>
        </div>
        <button onClick={handleExport} disabled={exporting}
          className="bg-slate-900 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors">
          {exporting ? 'Exporting…' : '↓ Export CSV'}
        </button>
      </div>

      {/* Condition balance chart */}
      {conditions.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Randomization Balance</h2>
          <div className="space-y-3">
            {conditions.map((c, i) => {
              const count = conditionCounts[c.label] || 0
              const max = Math.max(...Object.values(conditionCounts), 1)
              return (
                <div key={c.id} className="flex items-center gap-3">
                  <span className="w-28 text-sm text-slate-600 truncate">{c.label}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${(count / max) * 100}%` }} />
                  </div>
                  <span className="w-8 text-sm font-medium text-slate-700 text-right">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setFilterCondition('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterCondition === 'all' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
          All ({participants.length})
        </button>
        {conditions.map(c => (
          <button key={c.id} onClick={() => setFilterCondition(c.label)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterCondition === c.label ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            {c.label} ({conditionCounts[c.label] || 0})
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-center text-slate-400 py-10 text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">
          <p className="text-2xl mb-2">👥</p>
          <p className="text-sm">No participants yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Student ID','Email','Condition','Enrolled','Consent','Pre','Course','Post'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.student_id.slice(0, 12)}…</td>
                    <td className="px-4 py-3 text-slate-600">{maskEmail(p.email)}</td>
                    <td className="px-4 py-3">
                      <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">
                        {p.condition_label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{p.consent_given_at ? '✅' : '⬜'}</td>
                    <td className="px-4 py-3">{p.completed_pre_survey ? '✅' : '⬜'}</td>
                    <td className="px-4 py-3">{p.completed_course ? '✅' : '⬜'}</td>
                    <td className="px-4 py-3">{p.completed_post_survey ? '✅' : '⬜'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Link href="/dashboard"
        className="fixed bottom-6 left-60 inline-flex items-center gap-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-600 rounded-lg px-4 py-2 shadow-sm transition-colors z-10">
        ← Back to Studies
      </Link>
    </div>
  )
}
