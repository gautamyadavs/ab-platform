'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Study, QuestionType } from '@/lib/types'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-700',
  active: 'bg-green-100 text-green-700',
  closed: 'bg-slate-100 text-slate-500'
}

type ConditionDraft = { label: string; course_url: string; description: string }
const emptyCondition = (): ConditionDraft => ({ label: '', course_url: '', description: '' })

type BCQDraft = {
  question_text: string
  question_type: QuestionType
  choices: string[]
  mc_correct_index: number | null
  checkbox_correct_indices: number[]
  likert_scale: 5 | 7
  likert_low: string
  likert_high: string
  likert_correct: string
}

const emptyBCQ = (): BCQDraft => ({
  question_text: '',
  question_type: 'multiple_choice',
  choices: ['', ''],
  mc_correct_index: null,
  checkbox_correct_indices: [],
  likert_scale: 5,
  likert_low: 'Strongly Disagree',
  likert_high: 'Strongly Agree',
  likert_correct: ''
})

function buildBCQPayload(q: BCQDraft, index: number) {
  let options_json: object | null = null
  let correct_answer = ''

  if (q.question_type === 'multiple_choice' || q.question_type === 'checkbox') {
    const choices = q.choices.filter(c => c.trim())
    options_json = { choices }
    if (q.question_type === 'multiple_choice') {
      correct_answer = q.mc_correct_index !== null ? (q.choices[q.mc_correct_index]?.trim() || '') : ''
    } else {
      correct_answer = q.checkbox_correct_indices
        .map(i => q.choices[i]?.trim() || '')
        .filter(Boolean)
        .join('||')
    }
  } else if (q.question_type === 'likert') {
    options_json = { scale: q.likert_scale, low_label: q.likert_low, high_label: q.likert_high }
    correct_answer = q.likert_correct
  }

  return {
    question_text: q.question_text.trim(),
    question_type: q.question_type,
    options_json,
    correct_answer,
    order_index: index
  }
}

export default function DashboardPage() {
  const [studies, setStudies] = useState<Study[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [showNew, setShowNew] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ title: '', description: '', consent_text: '', target_per_condition: 50 })
  const [conditions, setConditions] = useState<ConditionDraft[]>([emptyCondition(), emptyCondition()])
  const [bgCheckEnabled, setBgCheckEnabled] = useState(false)
  const [bcQuestions, setBcQuestions] = useState<BCQDraft[]>([emptyBCQ()])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => { loadStudies() }, [])

  async function loadStudies() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

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
    setBgCheckEnabled(false)
    setBcQuestions([emptyBCQ()])
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

    const backgroundCheckQuestions = bgCheckEnabled
      ? bcQuestions.filter(q => q.question_text.trim()).map(buildBCQPayload)
      : []

    const res = await fetch('/api/studies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        study: { ...form, has_background_check: bgCheckEnabled },
        conditions,
        backgroundCheckQuestions
      })
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

  function updateBCQ(index: number, patch: Partial<BCQDraft>) {
    setBcQuestions(qs => qs.map((q, i) => i === index ? { ...q, ...patch } : q))
  }

  const totalSteps = bgCheckEnabled ? 3 : 2

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
              <StepDot num={1} current={step} label="Study Details" />
              <div className="flex-1 h-px bg-slate-200" />
              <StepDot num={2} current={step} label="Conditions" />
              {bgCheckEnabled && (
                <>
                  <div className="flex-1 h-px bg-slate-200" />
                  <StepDot num={3} current={step} label="Background Check" />
                </>
              )}
            </div>

            {/* ── Step 1: Study Details ── */}
            {step === 1 && (
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

                {/* Background check toggle */}
                <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <input
                    type="checkbox"
                    id="bg-check-toggle"
                    checked={bgCheckEnabled}
                    onChange={e => setBgCheckEnabled(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-amber-600 flex-shrink-0"
                  />
                  <div>
                    <label htmlFor="bg-check-toggle" className="text-sm font-medium text-slate-800 cursor-pointer">
                      Enable Background Check
                    </label>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Add questions shown to students before the course. Students always proceed regardless of their answers — responses are recorded for your analysis.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={closeNew}
                    className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">Cancel</button>
                  <button type="submit"
                    className="bg-blue-600 text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-blue-700">
                    Next: Add Conditions →
                  </button>
                </div>
              </form>
            )}

            {/* ── Step 2: Conditions ── */}
            {step === 2 && (
              <form onSubmit={e => { e.preventDefault(); bgCheckEnabled ? setStep(3) : createStudy(e) }} className="space-y-4">
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
                          <button type="button" onClick={() => setConditions(cs => cs.filter((_, j) => j !== i))}
                            className="ml-auto text-xs text-red-400 hover:text-red-600">Remove</button>
                        )}
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Label *</label>
                          <input required value={cond.label} onChange={e => updateCondition(i, 'label', e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g. Control, Treatment A, Video Format…" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Course URL *</label>
                          <input required type="url" value={cond.course_url} onChange={e => updateCondition(i, 'course_url', e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="https://…" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Description <span className="text-slate-400 font-normal">(internal notes, not shown to students)</span>
                          </label>
                          <textarea rows={2} value={cond.description} onChange={e => updateCondition(i, 'description', e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            placeholder="What makes this condition different from others?" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button type="button" onClick={() => setConditions(cs => [...cs, emptyCondition()])}
                  className="w-full border-2 border-dashed border-slate-300 hover:border-blue-400 text-slate-500 hover:text-blue-600 rounded-xl py-2.5 text-sm font-medium transition-colors">
                  + Add Another Condition
                </button>

                {saveError && !bgCheckEnabled && <p className="text-red-500 text-sm">{saveError}</p>}
                <div className="flex justify-between gap-3 pt-2">
                  <button type="button" onClick={() => setStep(1)}
                    className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">← Back</button>
                  <div className="flex gap-3">
                    <button type="button" onClick={closeNew}
                      className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">Cancel</button>
                    <button type="submit" disabled={saving}
                      className="bg-blue-600 text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                      {bgCheckEnabled ? 'Next: Background Check →' : (saving ? 'Creating…' : 'Create Study')}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* ── Step 3: Background Check Questions ── */}
            {step === 3 && bgCheckEnabled && (
              <form onSubmit={createStudy} className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Background Check</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Students will see these questions before the course. They always proceed regardless of their answers — you mark the expected answer for analysis purposes only.
                  </p>
                </div>

                <div className="space-y-4">
                  {bcQuestions.map((q, i) => (
                    <BCQCard
                      key={i}
                      q={q}
                      index={i}
                      total={bcQuestions.length}
                      onChange={patch => updateBCQ(i, patch)}
                      onRemove={() => setBcQuestions(qs => qs.filter((_, j) => j !== i))}
                    />
                  ))}
                </div>

                <button type="button" onClick={() => setBcQuestions(qs => [...qs, emptyBCQ()])}
                  className="w-full border-2 border-dashed border-slate-300 hover:border-amber-400 text-slate-500 hover:text-amber-600 rounded-xl py-2.5 text-sm font-medium transition-colors">
                  + Add Question
                </button>

                {saveError && <p className="text-red-500 text-sm">{saveError}</p>}
                <div className="flex justify-between gap-3 pt-2">
                  <button type="button" onClick={() => setStep(2)}
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
                    {study.has_background_check && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                        Background Check
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 truncate">{study.description}</p>
                  <p className="text-xs text-slate-400 mt-1">{counts[study.id] || 0} participants enrolled</p>
                </div>

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

              <div className="flex items-center gap-2 flex-wrap border-t border-slate-100 pt-3">
                <Link href={`/dashboard/studies/${study.id}/conditions`}
                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg px-3 py-1.5 transition-colors">
                  Conditions
                </Link>
                <Link href={`/dashboard/studies/${study.id}/surveys`}
                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg px-3 py-1.5 transition-colors">
                  Surveys
                </Link>
                {study.has_background_check && (
                  <Link href={`/dashboard/studies/${study.id}/background-check`}
                    className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg px-3 py-1.5 transition-colors">
                    Background Check
                  </Link>
                )}
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

// ── Sub-components ─────────────────────────────────────────────

function StepDot({ num, current, label }: { num: number; current: number; label: string }) {
  const done = num < current
  const active = num === current
  return (
    <div className={`flex items-center gap-1.5 text-sm font-medium whitespace-nowrap ${active ? 'text-blue-600' : done ? 'text-slate-400' : 'text-slate-400'}`}>
      <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold flex-shrink-0
        ${active ? 'bg-blue-600 text-white' : done ? 'bg-blue-200 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>
        {done ? '✓' : num}
      </span>
      <span className="hidden sm:inline">{label}</span>
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

// ── Background Check Question Card ─────────────────────────────

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'Multiple Choice',
  checkbox: 'Checkboxes',
  short_text: 'Short Answer',
  likert: 'Likert Scale'
}

function BCQCard({ q, index, total, onChange, onRemove }: {
  q: BCQDraft
  index: number
  total: number
  onChange: (patch: Partial<BCQDraft>) => void
  onRemove: () => void
}) {
  function updateChoice(ci: number, value: string) {
    const newChoices = q.choices.map((c, j) => j === ci ? value : c)
    onChange({ choices: newChoices })
  }

  function addChoice() {
    onChange({ choices: [...q.choices, ''] })
  }

  function removeChoice(ci: number) {
    const newChoices = q.choices.filter((_, j) => j !== ci)
    const newMC = q.mc_correct_index === ci ? null
      : q.mc_correct_index !== null && q.mc_correct_index > ci ? q.mc_correct_index - 1
      : q.mc_correct_index
    const newCB = q.checkbox_correct_indices
      .filter(j => j !== ci)
      .map(j => j > ci ? j - 1 : j)
    onChange({ choices: newChoices, mc_correct_index: newMC, checkbox_correct_indices: newCB })
  }

  function toggleCheckboxCorrect(ci: number) {
    const already = q.checkbox_correct_indices.includes(ci)
    const next = already
      ? q.checkbox_correct_indices.filter(j => j !== ci)
      : [...q.checkbox_correct_indices, ci]
    onChange({ checkbox_correct_indices: next })
  }

  function handleTypeChange(type: QuestionType) {
    onChange({ question_type: type, mc_correct_index: null, checkbox_correct_indices: [], likert_correct: '' })
  }

  return (
    <div className="border border-slate-200 rounded-xl p-4 relative">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
          {index + 1}
        </span>
        <span className="text-sm font-medium text-slate-700">Question {index + 1}</span>
        {total > 1 && (
          <button type="button" onClick={onRemove}
            className="ml-auto text-xs text-red-400 hover:text-red-600">Remove</button>
        )}
      </div>

      <div className="space-y-3">
        {/* Question text */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Question *</label>
          <input
            required
            value={q.question_text}
            onChange={e => onChange({ question_text: e.target.value })}
            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder="e.g. What is the main topic of this course?"
          />
        </div>

        {/* Question type */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Question Type</label>
          <select
            value={q.question_type}
            onChange={e => handleTypeChange(e.target.value as QuestionType)}
            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
          >
            {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map(t => (
              <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>

        {/* Multiple Choice */}
        {q.question_type === 'multiple_choice' && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">
              Options — <span className="text-amber-600 font-normal">mark the expected answer (for analysis)</span>
            </label>
            <div className="space-y-2">
              {q.choices.map((choice, ci) => (
                <div key={ci} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`mc-correct-${index}`}
                    checked={q.mc_correct_index === ci}
                    onChange={() => onChange({ mc_correct_index: ci })}
                    className="accent-amber-600 flex-shrink-0"
                    title="Mark as correct answer"
                  />
                  <input
                    value={choice}
                    onChange={e => updateChoice(ci, e.target.value)}
                    className="flex-1 border border-slate-300 rounded-lg px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder={`Option ${ci + 1}`}
                  />
                  {q.choices.length > 2 && (
                    <button type="button" onClick={() => removeChoice(ci)}
                      className="text-slate-400 hover:text-red-500 text-xs px-1">✕</button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-1.5">Click the radio button to mark the expected answer. Students always proceed regardless of what they choose.</p>
            <button type="button" onClick={addChoice}
              className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium">+ Add option</button>
          </div>
        )}

        {/* Checkboxes */}
        {q.question_type === 'checkbox' && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">
              Options — <span className="text-amber-600 font-normal">mark the expected answers (for analysis)</span>
            </label>
            <div className="space-y-2">
              {q.choices.map((choice, ci) => (
                <div key={ci} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={q.checkbox_correct_indices.includes(ci)}
                    onChange={() => toggleCheckboxCorrect(ci)}
                    className="accent-amber-600 flex-shrink-0"
                    title="Mark as correct answer"
                  />
                  <input
                    value={choice}
                    onChange={e => updateChoice(ci, e.target.value)}
                    className="flex-1 border border-slate-300 rounded-lg px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder={`Option ${ci + 1}`}
                  />
                  {q.choices.length > 2 && (
                    <button type="button" onClick={() => removeChoice(ci)}
                      className="text-slate-400 hover:text-red-500 text-xs px-1">✕</button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-1.5">Check the boxes to mark expected answers. Students always proceed regardless of what they select.</p>
            <button type="button" onClick={addChoice}
              className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium">+ Add option</button>
          </div>
        )}

        {/* Likert */}
        {q.question_type === 'likert' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Scale</label>
                <select
                  value={q.likert_scale}
                  onChange={e => onChange({ likert_scale: Number(e.target.value) as 5 | 7, likert_correct: '' })}
                  className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                >
                  <option value={5}>1 – 5</option>
                  <option value={7}>1 – 7</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">Low label</label>
                <input value={q.likert_low} onChange={e => onChange({ likert_low: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Strongly Disagree" />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">High label</label>
                <input value={q.likert_high} onChange={e => onChange({ likert_high: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Strongly Agree" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">
                Expected value — <span className="text-amber-600 font-normal">mark for analysis (optional)</span>
              </label>
              <div className="flex gap-2">
                {Array.from({ length: q.likert_scale }, (_, i) => i + 1).map(n => (
                  <button key={n} type="button"
                    onClick={() => onChange({ likert_correct: String(n) })}
                    className={`w-9 h-9 rounded-lg border-2 text-sm font-medium transition-colors
                      ${q.likert_correct === String(n)
                        ? 'bg-amber-500 border-amber-500 text-white'
                        : 'border-slate-300 text-slate-600 hover:border-amber-400'}`}>
                    {n}
                  </button>
                ))}
                {q.likert_correct && (
                  <button type="button" onClick={() => onChange({ likert_correct: '' })}
                    className="text-xs text-slate-400 hover:text-slate-600 ml-1">Clear</button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Short Text */}
        {q.question_type === 'short_text' && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
            <p className="text-xs text-slate-500">
              Short answer questions are informational — no correct answer is enforced. Students can always proceed after answering.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
