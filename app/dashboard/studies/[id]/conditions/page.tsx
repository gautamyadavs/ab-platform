'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Condition } from '@/lib/types'

export default function ConditionsPage() {
  const { id: studyId } = useParams<{ id: string }>()
  const [conditions, setConditions] = useState<Condition[]>([])
  const [studyTitle, setStudyTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ label: '', course_url: '', internal_notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [studyId])

  async function load() {
    const { data: study } = await supabase.from('studies').select('title').eq('id', studyId).single()
    setStudyTitle(study?.title || '')
    const { data } = await supabase
      .from('conditions')
      .select('*')
      .eq('study_id', studyId)
      .order('display_order')
    setConditions(data || [])
    setLoading(false)
  }

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }

  async function addCondition(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const token = await getToken()
    const res = await fetch('/api/conditions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        studyId,
        label: form.label,
        course_url: form.course_url,
        internal_notes: form.internal_notes,
        display_order: conditions.length
      })
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Failed to add condition.')
      setSaving(false)
      return
    }

    setSaving(false)
    setShowForm(false)
    setForm({ label: '', course_url: '', internal_notes: '' })
    load()
  }

  async function deleteCondition(id: string) {
    if (!confirm('Delete this condition and all its surveys?')) return
    const token = await getToken()
    await fetch(`/api/conditions?id=${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    load()
  }

  return (
    <div className="max-w-3xl pb-20">
      <div className="flex items-center gap-2 text-sm text-slate-400 mb-6">
        <Link href="/dashboard" className="hover:text-blue-600">Studies</Link>
        <span>/</span>
        <span className="text-slate-600 font-medium">{studyTitle}</span>
        <span>/</span>
        <span className="text-slate-600">Conditions</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Conditions</h1>
          <p className="text-slate-500 text-sm mt-1">Each condition gets a different course URL</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors">
          + Add Condition
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm py-10 text-center">Loading…</p>
      ) : conditions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">
          <p className="text-2xl mb-2">🔀</p>
          <p className="font-medium text-slate-600">No conditions yet</p>
          <p className="text-sm mt-1">Add at least 2 conditions (e.g. Control, Treatment A)</p>
        </div>
      ) : (
        <div className="space-y-3">
          {conditions.map((c, i) => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <h3 className="font-semibold text-slate-900">{c.label}</h3>
                  </div>
                  <a href={c.course_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline break-all ml-10">
                    {c.course_url}
                  </a>
                  {c.internal_notes && (
                    <p className="text-xs text-slate-400 mt-1 ml-10 italic">{c.internal_notes}</p>
                  )}
                </div>
                <button onClick={() => deleteCondition(c.id)}
                  className="text-xs text-red-400 hover:text-red-600 ml-4">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-7">
            <h2 className="text-lg font-bold text-slate-900 mb-5">Add Condition</h2>
            <form onSubmit={addCondition} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Label *</label>
                <input required value={form.label} onChange={e => setForm(f => ({...f, label: e.target.value}))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Control, Treatment A, Video Format…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Course URL *</label>
                <input required type="url" value={form.course_url} onChange={e => setForm(f => ({...f, course_url: e.target.value}))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://youtube.com/… or https://docs.google.com/…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Internal notes (not shown to students)</label>
                <textarea rows={2} value={form.internal_notes} onChange={e => setForm(f => ({...f, internal_notes: e.target.value}))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="What makes this condition different?" />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setError('') }}
                  className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">Cancel</button>
                <button type="submit" disabled={saving}
                  className="bg-blue-600 text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Adding…' : 'Add Condition'}
                </button>
              </div>
            </form>
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
