'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { SurveyQuestion, Condition } from '@/lib/types'
import { QuestionRenderer } from '@/components/survey/QuestionRenderer'

interface Study {
  id: string
  title: string
  description: string
  consent_text: string
}

interface EnrollmentWizardProps {
  study: Study
}

const STEPS = [
  'Email',
  'Consent',
  'Demographics',
  'Pre-Survey',
  'Course',
  'Post-Survey',
  'Done'
]

export default function EnrollmentWizard({ study }: EnrollmentWizardProps) {
  const [step, setStep] = useState(0)
  const [email, setEmail] = useState('')
  const [participantId, setParticipantId] = useState('')
  const [studentId, setStudentId] = useState('')
  const [conditionId, setConditionId] = useState('')
  const [condition, setCondition] = useState<Condition | null>(null)
  const [preQuestions, setPreQuestions] = useState<SurveyQuestion[]>([])
  const [postQuestions, setPostQuestions] = useState<SurveyQuestion[]>([])
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, string>>({})
  const [demographics, setDemographics] = useState({
    age_range: '', gender: '', education_level: '', field_of_study: '', prior_experience: ''
  })
  const [consentChecked, setConsentChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Derived: which steps are visible (skip pre/post if no questions)
  const hasPreSurvey = preQuestions.length > 0
  const hasPostSurvey = postQuestions.length > 0

  const visibleSteps = STEPS.filter((s, i) => {
    if (s === 'Pre-Survey' && !hasPreSurvey) return false
    if (s === 'Post-Survey' && !hasPostSurvey) return false
    return true
  })

  // ── Step 0: Email ────────────────────────────────────────────
  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studyId: study.id, email })
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setLoading(false); return }

    setParticipantId(data.participantId)
    setStudentId(data.studentId)
    setConditionId(data.conditionId)

    // Fetch condition info and survey questions
    const { data: cond } = await supabase
      .from('conditions')
      .select('*')
      .eq('id', data.conditionId)
      .single()
    setCondition(cond)

    const { data: qs } = await supabase
      .from('survey_questions')
      .select('*')
      .eq('condition_id', data.conditionId)
      .order('order_index')
    setPreQuestions(qs?.filter(q => q.survey_type === 'pre') || [])
    setPostQuestions(qs?.filter(q => q.survey_type === 'post') || [])

    // If already enrolled, skip to course step
    if (data.alreadyEnrolled) {
      setStep(visibleSteps.indexOf('Course'))
    } else {
      setStep(1)
    }
    setLoading(false)
  }

  // ── Step 1: Consent ──────────────────────────────────────────
  async function handleConsentSubmit() {
    setLoading(true)
    await supabase.from('participants').update({
      consent_given_at: new Date().toISOString()
    }).eq('id', participantId)
    setLoading(false)
    setStep(2)
  }

  // ── Step 2: Demographics ─────────────────────────────────────
  async function handleDemographicsSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await supabase.from('demographic_responses').insert({
      participant_id: participantId,
      age_range: demographics.age_range || null,
      gender: demographics.gender || null,
      education_level: demographics.education_level || null,
      field_of_study: demographics.field_of_study || null,
      prior_experience: demographics.prior_experience ? parseInt(demographics.prior_experience) : null
    })
    setLoading(false)
    setStep(hasPreSurvey ? visibleSteps.indexOf('Pre-Survey') : visibleSteps.indexOf('Course'))
  }

  // ── Step: Survey submit (pre or post) ────────────────────────
  async function handleSurveySubmit(questions: SurveyQuestion[], surveyType: 'pre' | 'post') {
    setLoading(true)

    // Validate required
    const missing = questions.filter(q => q.is_required && !surveyAnswers[q.id])
    if (missing.length > 0) {
      setError('Please answer all required questions.')
      setLoading(false)
      return
    }

    // Save responses
    const inserts = questions.map(q => ({
      participant_id: participantId,
      question_id: q.id,
      response_value: surveyAnswers[q.id] || ''
    }))
    await supabase.from('survey_responses').upsert(inserts)

    // Mark survey as completed
    const updateField = surveyType === 'pre' ? 'completed_pre_survey' : 'completed_post_survey'
    await supabase.from('participants').update({ [updateField]: true }).eq('id', participantId)

    setError('')
    setLoading(false)
    const nextStep = surveyType === 'pre'
      ? visibleSteps.indexOf('Course')
      : visibleSteps.indexOf('Done')
    setStep(nextStep)
  }

  // ── Step: Course done ────────────────────────────────────────
  async function handleCourseComplete() {
    setLoading(true)
    await supabase.from('participants').update({ completed_course: true }).eq('id', participantId)
    setLoading(false)
    setStep(hasPostSurvey ? visibleSteps.indexOf('Post-Survey') : visibleSteps.indexOf('Done'))
  }

  // ── Shared answer setter ──────────────────────────────────────
  function setAnswer(questionId: string, value: string) {
    setSurveyAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  const currentStepName = visibleSteps[step]

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          {visibleSteps.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                ${i < step ? 'bg-blue-600 border-blue-600 text-white' : i === step ? 'border-blue-600 text-blue-600' : 'border-slate-300 text-slate-400'}`}>
                {i < step ? '✓' : i + 1}
              </div>
              {i < visibleSteps.length - 1 && (
                <div className={`h-0.5 flex-1 ${i < step ? 'bg-blue-600' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>
        <p className="text-sm text-slate-500">Step {step + 1} of {visibleSteps.length}: <span className="font-medium text-slate-700">{currentStepName}</span></p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-8">

        {/* STEP: Email */}
        {currentStepName === 'Email' && (
          <form onSubmit={handleEmailSubmit}>
            <h2 className="text-xl font-bold text-slate-900 mb-1">{study.title}</h2>
            <p className="text-slate-500 text-sm mb-6">{study.description}</p>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Your email address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              placeholder="your@email.com"
            />
            <p className="text-xs text-slate-400 mb-6">
              Your email is used only to track your progress. It will not be shared.
            </p>
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {loading ? 'Checking…' : 'Continue →'}
            </button>
          </form>
        )}

        {/* STEP: Consent */}
        {currentStepName === 'Consent' && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-4">Informed Consent</h2>
            <div className="bg-slate-50 rounded-xl p-5 text-sm text-slate-700 leading-relaxed max-h-64 overflow-y-auto mb-6 border border-slate-200 whitespace-pre-wrap">
              {study.consent_text}
            </div>
            <label className="flex items-start gap-3 cursor-pointer mb-6">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={e => setConsentChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-blue-600"
              />
              <span className="text-sm text-slate-700">
                I have read the above information and agree to participate in this study.
              </span>
            </label>
            <button
              onClick={handleConsentSubmit}
              disabled={!consentChecked || loading}
              className="w-full bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {loading ? 'Saving…' : 'I Agree, Continue →'}
            </button>
          </div>
        )}

        {/* STEP: Demographics */}
        {currentStepName === 'Demographics' && (
          <form onSubmit={handleDemographicsSubmit}>
            <h2 className="text-xl font-bold text-slate-900 mb-1">About You</h2>
            <p className="text-slate-500 text-sm mb-6">All fields are optional. This helps us understand our learners.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Age range</label>
                <select value={demographics.age_range} onChange={e => setDemographics(d => ({...d, age_range: e.target.value}))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Prefer not to say</option>
                  {['Under 18','18–24','25–34','35–44','45–54','55–64','65+'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
                <select value={demographics.gender} onChange={e => setDemographics(d => ({...d, gender: e.target.value}))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Prefer not to say</option>
                  {['Female','Male','Non-binary','Other'].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Highest education level</label>
                <select value={demographics.education_level} onChange={e => setDemographics(d => ({...d, education_level: e.target.value}))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Prefer not to say</option>
                  {['High school','Some college','Bachelor\'s','Master\'s','Doctorate','Other'].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Field of study or work</label>
                <input type="text" value={demographics.field_of_study}
                  onChange={e => setDemographics(d => ({...d, field_of_study: e.target.value}))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Computer Science, Nursing…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Prior experience with this topic (1 = none, 5 = expert)
                </label>
                <div className="flex gap-3">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} type="button"
                      onClick={() => setDemographics(d => ({...d, prior_experience: String(n)}))}
                      className={`w-10 h-10 rounded-xl border-2 text-sm font-medium transition-colors
                        ${demographics.prior_experience === String(n)
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-slate-300 text-slate-600 hover:border-blue-400'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="mt-6 w-full bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {loading ? 'Saving…' : 'Continue →'}
            </button>
          </form>
        )}

        {/* STEP: Pre-Survey */}
        {currentStepName === 'Pre-Survey' && (
          <SurveyStep
            title="Pre-Course Survey"
            subtitle="A few quick questions before you begin."
            questions={preQuestions}
            answers={surveyAnswers}
            setAnswer={setAnswer}
            onSubmit={() => handleSurveySubmit(preQuestions, 'pre')}
            loading={loading}
            error={error}
          />
        )}

        {/* STEP: Course */}
        {currentStepName === 'Course' && condition && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Your Course</h2>
            <p className="text-slate-500 text-sm mb-6">
              Take your time with the material. Click the button below when you're done.
            </p>
            <CourseEmbed url={condition.course_url} />
            <button onClick={handleCourseComplete} disabled={loading}
              className="mt-6 w-full bg-green-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
              {loading ? 'Saving…' : "I've finished the course →"}
            </button>
          </div>
        )}

        {/* STEP: Post-Survey */}
        {currentStepName === 'Post-Survey' && (
          <SurveyStep
            title="Post-Course Survey"
            subtitle="Almost done! Tell us what you thought."
            questions={postQuestions}
            answers={surveyAnswers}
            setAnswer={setAnswer}
            onSubmit={() => handleSurveySubmit(postQuestions, 'post')}
            loading={loading}
            error={error}
          />
        )}

        {/* STEP: Done */}
        {currentStepName === 'Done' && (
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🎉</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">All done — thank you!</h2>
            <p className="text-slate-500 text-sm mb-6">
              Your participation helps us understand learning better. Please save your Student ID below.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
              <p className="text-xs text-slate-500 mb-1">Your Student ID</p>
              <p className="font-mono text-blue-700 text-sm font-bold break-all">{studentId}</p>
            </div>
            <a href="/courses"
              className="inline-block bg-blue-600 text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors">
              Browse More Courses
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────

function SurveyStep({ title, subtitle, questions, answers, setAnswer, onSubmit, loading, error }: {
  title: string
  subtitle: string
  questions: SurveyQuestion[]
  answers: Record<string, string>
  setAnswer: (id: string, val: string) => void
  onSubmit: () => void
  loading: boolean
  error: string
}) {
  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 mb-1">{title}</h2>
      <p className="text-slate-500 text-sm mb-6">{subtitle}</p>
      <div className="space-y-6">
        {questions.map(q => (
          <QuestionRenderer key={q.id} question={q} value={answers[q.id] || ''} onChange={v => setAnswer(q.id, v)} />
        ))}
      </div>
      {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
      <button onClick={onSubmit} disabled={loading}
        className="mt-6 w-full bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
        {loading ? 'Saving…' : 'Submit & Continue →'}
      </button>
    </div>
  )
}

// QuestionRenderer is imported from @/components/survey/QuestionRenderer

function CourseEmbed({ url }: { url: string }) {
  const isYoutube = url.includes('youtube.com') || url.includes('youtu.be')
  const isVimeo = url.includes('vimeo.com')

  if (isYoutube) {
    const videoId = url.match(/(?:v=|youtu\.be\/)([^&\s]+)/)?.[1]
    return (
      <div className="aspect-video rounded-xl overflow-hidden bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  if (isVimeo) {
    const videoId = url.match(/vimeo\.com\/(\d+)/)?.[1]
    return (
      <div className="aspect-video rounded-xl overflow-hidden bg-black">
        <iframe src={`https://player.vimeo.com/video/${videoId}`}
          className="w-full h-full" allowFullScreen />
      </div>
    )
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center">
      <p className="text-slate-500 text-sm mb-4">Your course is hosted externally.</p>
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="inline-block bg-blue-600 text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors">
        Open Course in New Tab ↗
      </a>
    </div>
  )
}
