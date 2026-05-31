'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Condition, SurveyQuestion, QuestionType, SurveyType } from '@/lib/types'

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'checkbox', label: 'Checkboxes' },
  { value: 'likert', label: 'Likert Scale' },
  { value: 'short_text', label: 'Short Text' }
]

export default function SurveysPage() {
  const { id: studyId } = useParams<{ id: string }>()
  const [conditions, setConditions] = useState<Condition[]>([])
  const [activeCondition, setActiveCondition] = useState<string>('')
  const [activeSurveyType, setActiveSurveyType] = useState<SurveyType>('pre')
  const [questions, setQuestions] = useState<SurveyQuestion[]>([])
  const [studyTitle, setStudyTitle] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<{
    question_text: string
    question_type: QuestionType
    is_required: boolean
    choices: string
    likert_scale: 5 | 7
    low_label: string
    high_label: string
  }>({
    question_text: '',
    question_type: 'multiple_choice',
    is_required: true,
    choices: '',
    likert_scale: 5,
    low_label: 'Strongly Disagree',
    high_label: 'Strongly Agree'
  })

  useEffect(() => { loadConditions() }, [studyId])
  useEffect(() => { if (activeCondition) loadQuestions() }, [activeCondition, activeSurveyType])

  async function loadConditions() {
    const { data: study } = await supabase.from('studies').select('title').eq('id', studyId).single()
    setStudyTitle(study?.title || '')
    const { data } = await supabase.from('conditions').select('*').eq('study_id', studyId).order('display_order')
    setConditions(data || [])
    if (data && data.length > 0) setActiveCondition(data[0].id)
  }

  async function loadQuestions() {
    const { data } = await supabase
      .from('survey_questions')
      .select('*')
      .eq('condition_id', activeCondition)
      .eq('survey_type', activeSurveyType)
      .order('order_index')
    setQuestions(data || [])
  }

  async function addQuestion(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    let options_json = null
    if (form.question_type === 'multiple_choice' || form.question_type === 'checkbox') {
      options_json = { choices: form.choices.split('\n').map(c => c.trim()).filter(Boolean) }
    } else if (form.question_type === 'likert') {
      options_json = { scale: form.likert_scale, low_label: form.low_label, high_label: form.high_label }
    }
    await supabase.from('survey_questions').insert({
      condition_id: activeCondition,
      survey_type: activeSurveyType,
      question_text: form.question_text,
      question_type: form.question_type,
      options_json,
      is_required: form.is_required,
      order_index: questions.length
    })
    setSaving(false)
    setShowForm(false)
    resetForm()
    loadQuestions()
  }

  function resetForm() {
    setForm({ question_text: '', question_type: 'multiple_choice', is_required: true, choices: '', likert_scale: 5, low_label: 'Strongly Disagree', high_label: 'Strongly Agree' })
  }

  async function deleteQuestion(id: string) {
    await supabase.from('survey_questions').delete().eq('id', id)
    loadQuestions()
  }

  const activeConditionLabel = conditions.find(c => c.id === activeCondition)?.label || ''

  return (
    <div className="max-w-3xl pb-20">
      <div className="flex items-center gap-2 text-sm text-slate-400 mb-6">
        <Link href="/dashboard" className="hover:text-blue-600">Studies</Link>
        <span>/</span>
        <span className="text-slate-600 font-medium">{studyTitle}</span>
        <span>/</span>
        <span className="text-slate-600">Surveys</span>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 mb-6">Survey Builder</h1>

      {conditions.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-amber-800 text-sm">
          You need to add conditions first before building surveys.{' '}
          <Link href={`/dashboard/studies/${studyId}/conditions`} className="underline">Add conditions →</Link>
        </div>
      ) : (
        <>
          {/* Condition tabs */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {conditions.map((c, i) => (
              <button key={c.id} onClick={() => setActiveCondition(c.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeCondition === c.id ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300'
                }`}>
                {String.fromCharCode(65 + i)}: {c.label}
              </button>
            ))}
          </div>

          {/* Pre/Post tabs */}
          <div className="flex gap-2 mb-6">
            {(['pre', 'post'] as SurveyType[]).map(t => (
              <button key={t} onClick={() => setActiveSurveyType(t)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  activeSurveyType === t ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-400'
                }`}>
                {t === 'pre' ? 'Pre-Course Survey' : 'Post-Course Survey'}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500">
              <span className="font-medium text-slate-700">{activeConditionLabel}</span> — {activeSurveyType}-course survey ({questions.length} questions)
            </p>
            <button onClick={() => setShowForm(true)}
              className="bg-blue-600 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors">
              + Add Question
            </button>
          </div>

          {questions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-400">
              <p className="text-2xl mb-2">📝</p>
              <p className="text-sm">No questions yet. Add the first one!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((q, i) => (
                <div key={q.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-400">Q{i + 1}</span>
                        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                          {QUESTION_TYPES.find(t => t.value === q.question_type)?.label}
                        </span>
                        {q.is_required && <span className="text-xs text-red-400">Required</span>}
                      </div>
                      <p className="text-sm font-medium text-slate-800">{q.question_text}</p>
                      {q.options_json && (
                        <p className="text-xs text-slate-400 mt-1">
                          {(q.options_json as any).choices
                            ? (q.options_json as any).choices.join(' · ')
                            : `Scale 1–${(q.options_json as any).scale}: ${(q.options_json as any).low_label} → ${(q.options_json as any).high_label}`}
                        </p>
                      )}
                    </div>
                    <button onClick={() => deleteQuestion(q.id)}
                      className="text-xs text-red-400 hover:text-red-600 flex-shrink-0">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Add question modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-7 my-4">
            <h2 className="text-lg font-bold text-slate-900 mb-5">Add Question</h2>
            <form onSubmit={addQuestion} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Question text *</label>
                <textarea required rows={2} value={form.question_text}
                  onChange={e => setForm(f => ({...f, question_text: e.target.value}))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="How would you rate your confidence with…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Question type</label>
                <select value={form.question_type} onChange={e => setForm(f => ({...f, question_type: e.target.value as QuestionType}))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              {(form.question_type === 'multiple_choice' || form.question_type === 'checkbox') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Options (one per line)</label>
                  <textarea rows={4} value={form.choices} onChange={e => setForm(f => ({...f, choices: e.target.value}))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder={"Strongly agree\nAgree\nNeutral\nDisagree\nStrongly disagree"} />
                </div>
              )}

              {form.question_type === 'likert' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Scale size</label>
                    <select value={form.likert_scale} onChange={e => setForm(f => ({...f, likert_scale: parseInt(e.target.value) as 5 | 7}))}
                      className="w-32 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value={5}>5-point</option>
                      <option value={7}>7-point</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Low end label</label>
                      <input value={form.low_label} onChange={e => setForm(f => ({...f, low_label: e.target.value}))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">High end label</label>
                      <input value={form.high_label} onChange={e => setForm(f => ({...f, high_label: e.target.value}))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_required} onChange={e => setForm(f => ({...f, is_required: e.target.checked}))}
                  className="accent-blue-600" />
                <span className="text-sm text-slate-700">Required question</span>
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); resetForm() }}
                  className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">Cancel</button>
                <button type="submit" disabled={saving}
                  className="bg-blue-600 text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Adding…' : 'Add Question'}
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
