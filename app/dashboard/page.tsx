'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Study } from '@/lib/types'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-700',
  active: 'bg-green-100 text-green-700',
  closed: 'bg-slate-100 text-slate-500'
}

type ConditionDraft = { label: string; course_url: string; description: string }
const emptyCondition = (): ConditionDraft => ({ label: '', course_url: '', description: '' })

export default function DashboardPage() {
  const [studies, setStudies] = useState<Study[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [showNew, setShowNew] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ title: '', description: '', consent_text: '', target_per_condition: 50 })
  const [conditions, setConditions] = useState<ConditionDraft[]>([emptyCondition(), emptyCondition()])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => { loadStudies() }, [])

  async function loadStudies() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    // Get all study IDs this researcher belongs to
    const { data: srData } = await supabase
      .from('study_researchers')
      .select('study_id')
      .eq('researcher_id', user.id)

    const studyIds = srData?.map(sr => sr.study_id) || []

    if (studyIds.length === 0) {
      setStudies([])
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('studies')
      .select('*')
      .in('id', studyIds)
      .order('created_at', { ascending: false })
    setStudies(data || [])

    const { data: parts } = await supabase
      .from('participants')
      .select('study_id')
      .in('study_id', studyIds)
    const c: Record<string, number> = {}
    parts?.forEach(p => { c[p.study_id] = (c[p.study_id] || 0) + 1 })
    setCounts(c)

    setLoading(false)
  }

  function openNew() {
    setForm({ title: '', description: '', consent_text: '', target_per_condition: 50 })
    setConditions([emptyCondition(), emptyCondition()])
    setStep(1)
    setShowNew(true)
  }

  function closeNew() {
    setShowNew(false)
    setStep(1)
    setSaveError('')
  }

  async function createStudy(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveError('')

    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    const res = await fetch('/api/studies', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ study: form, conditions })
    })

    if (!res.ok) {
      const { error } = await res.json()
      setSaveError(error || 'Something went wrong. Please try again.')
      setSaving(false)
      return
    }

    setSaving(false)
    closeNew()
    loadStudies()
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('studies').update({ status }).eq('id', id)
    loadStudies()
  }

  function updateCondition(index: number, field: keyof ConditionDraft, value: string) {
    setConditions(cs => cs.map((c, i) => i === index ? { ...c, [field]: value } : c))
  }

  function addCondition() {
    setConditions(cs => [...cs, emptyCondition()])
  }

  function removeCondition(index: number) {
    setConditions(cs => cs.filter((_, i) => i !== index))
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Studies</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your A/B learning experiments</p>
        </div>
        <button onClick={openNew}
          className="bg-blue-600 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors">
          + New Study
        </button>
      </div>

      {/* New study modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-7 max-h-[90vh] overflow-y-auto">
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-6">
              <div className={`flex items-center gap-1.5 text-sm font-medium ${step === 1 ? 'text-blue-600' : 'text-slate-400'}`}>
                <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold ${step === 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>1</span>
                Study Details
              </div>
              <div className="flex-1 h-px bg-slate-200" />
              <div className={`flex items-center gap-1.5 text-sm font-medium ${step === 2 ? 'text-blue-600' : 'text-slate-400'}`}>
                <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold ${step === 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>2</span>
                Conditions
              </div>
            </div>

            {step === 1 ? (
              <form onSubmit={e => { e.preventDefault(); setStep(2) }} className="space-y-4">
                <h2 className="text-lg font-bold text-slate-900">Study Details</h2>
                <FormField label="Study Title *">
                  <input required value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
                    className="input" placeholder="e.g. Intro to Statistics" />
                </FormField>
                <FormField label="Description">
                  <textarea rows={2} value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
                    className="input resize-none" placeholder="Brief description shown to students" />
                </FormField>
                <FormField label="Informed Consent Text *">
                  <textarea required rows={5} value={form.consent_text} onChange={e => setForm(f => ({...f, consent_text: e.target.value}))}
                    className="input resize-none" placeholder="Paste your IRB-approved consent form text here…" />
                </FormField>
                <FormField label="Target participants per condition">
                  <input type="number" min={1} value={form.target_per_condition}
                    onChange={e => setForm(f => ({...f, target_per_condition: parseInt(e.target.value)}))}
                    className="input w-32" />
                </FormField>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={closeNew}
                    className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">Cancel</button>
                  <button type="submit"
                    className="bg-blue-600 text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-blue-700">
                    Next: Add Conditions →
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={createStudy} className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Study Conditions</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Define the different treatment groups for your experiment</p>
                </div>

                <div className="space-y-4">
                  {conditions.map((cond, i) => (
                    <div key={i} className="border border-slate-200 rounded-xl p-4 relative">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span className="text-sm font-medium text-slate-700">Condition {String.fromCharCode(65 + i)}</span>
                        {conditions.length > 1 && (
                          <button type="button" onClick={() => removeCondition(i)}
                            className="ml-auto text-xs text-red-400 hover:text-red-600">Remove</button>
                        )}
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Label *</label>
                          <input
                            required
                            value={cond.label}
                            onChange={e => updateCondition(i, 'label', e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g. Control, Treatment A, Video Format…"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Course URL *</label>
                          <input
                            required
                            type="url"
                            value={cond.course_url}
                            onChange={e => updateCondition(i, 'course_url', e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="https://…"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Description <span className="text-slate-400 font-normal">(internal notes, not shown to students)</span></label>
                          <textarea
                            rows={2}
                            value={cond.description}
                            onChange={e => updateCondition(i, 'description', e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            placeholder="What makes this condition different from others?"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button type="button" onClick={addCondition}
                  className="w-full border-2 border-dashed border-slate-300 hover:border-blue-400 text-slate-500 hover:text-blue-600 rounded-xl py-2.5 text-sm font-medium transition-colors">
                  + Add Another Condition
                </button>

                {saveError && (
                  <p className="text-red-500 text-sm">{saveError}</p>
                )}
                <div className="flex justify-between gap-3 pt-2">
                  <button type="button" onClick={() => setStep(1)}
                    className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">← Back</button>
                  <div className="flex gap-3">
                    <button type="button" onClick={closeNew}
                      className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">Cancel</button>
                    <button type="submit" disabled={saving}
                      className="bg-blue-600 text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                      {saving ? 'Creating…' : 'Create Study'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Study list */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 text-sm">Loading…</div>
      ) : studies.length === 0 ? (
        <div className="py-20 text-center text-slate-400">
          <p className="text-4xl mb-3">🔬</p>
          <p className="font-medium text-slate-600">No studies yet</p>
          <p className="text-sm mt-1">Create your first study to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {studies.map(study => (
            <div key={study.id} className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <h3 className="font-semibold text-slate-900">{study.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[study.status]}`}>
                      {study.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 truncate">{study.description}</p>
                  <p className="text-xs text-slate-400 mt-1">{counts[study.id] || 0} participants enrolled</p>
                </div>

                {/* Status action */}
                {study.status === 'draft' && (
                  <button onClick={() => updateStatus(study.id, 'active')}
                    className="flex-shrink-0 text-sm bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl px-4 py-2 transition-colors">
                    Activate
                  </button>
                )}
                {study.status === 'active' && (
                  <button onClick={() => updateStatus(study.id, 'closed')}
                    className="flex-shrink-0 text-sm bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-xl px-4 py-2 transition-colors">
                    Close Study
                  </button>
                )}
              </div>

              {/* Navigation links */}
              <div className="flex items-center gap-2 flex-wrap border-t border-slate-100 pt-3">
                <Link href={`/dashboard/studies/${study.id}/conditions`}
                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg px-3 py-1.5 transition-colors">
                  Conditions
                </Link>
                <Link href={`/dashboard/studies/${study.id}/surveys`}
                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg px-3 py-1.5 transition-colors">
                  Surveys
                </Link>
                <Link href={`/dashboard/studies/${study.id}/participants`}
                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg px-3 py-1.5 transition-colors">
                  Participants
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  )
}
