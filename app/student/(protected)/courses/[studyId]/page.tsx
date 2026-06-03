'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Condition, SurveyQuestion, BackgroundCheckQuestion } from '@/lib/types'
import { QuestionRenderer, QuestionLike } from '@/components/survey/QuestionRenderer'

type CourseStep = 'loading' | 'bcq' | 'disqualified' | 'consent' | 'pre_survey' | 'course' | 'post_survey'

function checkAnswer(response: string, expected: string, questionType: string): boolean {
  if (!expected || questionType === 'short_text') return true
  if (questionType === 'multiple_choice') {
    const correctSet = new Set(expected.split('||').map(s => s.trim()).filter(Boolean))
    return correctSet.has(response.trim())
  }
  if (questionType === 'checkbox') {
    const r = new Set(response.split('||').map(s => s.trim()).filter(Boolean))
    const e = new Set(expected.split('||').map(s => s.trim()).filter(Boolean))
    if (r.size !== e.size) return false
    for (const item of e) if (!r.has(item)) return false
    return true
  }
  return response.trim() === expected.trim()
}

interface StudyInfo {
  id: string
  title: string
  description: string
  consent_text: string
  has_background_check: boolean
}

export default function StudentCoursePage() {
  const router = useRouter()
  const { studyId } = useParams<{ studyId: string }>()

  const [step, setStep] = useState<CourseStep>('loading')
  const [visibleSteps, setVisibleSteps] = useState<string[]>([])
  const [study, setStudy] = useState<StudyInfo | null>(null)
  const [bcqQuestions, setBcqQuestions] = useState<BackgroundCheckQuestion[]>([])
  const [bcqAnswers, setBcqAnswers] = useState<Record<string, string>>({})
  const [participantId, setParticipantId] = useState('')
  const [condition, setCondition] = useState<Condition | null>(null)
  const [preQuestions, setPreQuestions] = useState<SurveyQuestion[]>([])
  const [postQuestions, setPostQuestions] = useState<SurveyQuestion[]>([])
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, string>>({})
  const [consentChecked, setConsentChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { init() }, [studyId])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push(`/student/login?redirect=/student/courses/${studyId}`)
      return
    }

    const { data: studyData } = await supabase
      .from('studies')
      .select('id, title, description, consent_text, has_background_check, status')
      .eq('id', studyId)
      .single()

    if (!studyData || studyData.status !== 'active') {
      router.push('/student/portal')
      return
    }
    setStudy(studyData)

    // Fetch background check questions
    let bcqs: BackgroundCheckQuestion[] = []
    if (studyData.has_background_check) {
      const { data } = await supabase
        .from('background_check_questions')
        .select('*')
        .eq('study_id', studyId)
        .order('order_index')
      bcqs = data || []
      setBcqQuestions(bcqs)
    }

    const email = user.email!.toLowerCase().trim()

    // Check existing enrollment
    const { data: participant } = await supabase
      .from('participants')
      .select('id, condition_id, consent_given_at, completed_pre_survey, completed_course, completed_post_survey')
      .eq('study_id', studyId)
      .eq('email', email)
      .single()

    if (participant) {
      setParticipantId(participant.id)

      // Fetch condition + survey questions
      const { data: cond } = await supabase
        .from('conditions').select('*').eq('id', participant.condition_id).single()
      setCondition(cond)

      const { data: qs } = await supabase
        .from('survey_questions').select('*').eq('condition_id', participant.condition_id).order('order_index')
      const pre = qs?.filter((q: SurveyQuestion) => q.survey_type === 'pre') || []
      const post = qs?.filter((q: SurveyQuestion) => q.survey_type === 'post') || []
      setPreQuestions(pre)
      setPostQuestions(post)

      // Compute steps for progress indicator
      setVisibleSteps(buildStepLabels(bcqs, pre, post, false))

      // Determine resume step
      if (participant.completed_course) {
        if (post.length > 0 && !participant.completed_post_survey) {
          setStep('post_survey')
        } else {
          router.push('/student/portal')
        }
        return
      }
      if (participant.consent_given_at) {
        setStep(pre.length > 0 && !participant.completed_pre_survey ? 'pre_survey' : 'course')
        return
      }
      setStep('consent')
      return
    }

    // Not enrolled yet
    setVisibleSteps(buildStepLabels(bcqs, [], [], true))
    setStep(bcqs.length > 0 ? 'bcq' : 'consent')
  }

  function buildStepLabels(
    bcqs: BackgroundCheckQuestion[],
    pre: SurveyQuestion[],
    post: SurveyQuestion[],
    isNew: boolean
  ) {
    const s: string[] = []
    if (isNew && bcqs.length > 0) s.push('Background Check')
    if (isNew) s.push('Consent')
    if (pre.length > 0) s.push('Pre-Survey')
    s.push('Course')
    if (post.length > 0) s.push('Post-Survey')
    return s
  }

  // ── BCQ step ─────────────────────────────────────────────────
  function handleBCQContinue() {
    setError('')

    // Require an answer for every question that has options (not short_text)
    const unanswered = bcqQuestions.filter(q =>
      q.question_type !== 'short_text' && !bcqAnswers[q.id]?.trim()
    )
    if (unanswered.length > 0) {
      setError('Please answer all questions before continuing.')
      return
    }

    // Check each question that has a correct answer set
    const failed = bcqQuestions.some(q =>
      q.correct_answer && !checkAnswer(bcqAnswers[q.id] || '', q.correct_answer, q.question_type)
    )

    setStep(failed ? 'disqualified' : 'consent')
  }

  // ── Consent + enrollment ──────────────────────────────────────
  async function handleConsent() {
    setSubmitting(true)
    setError('')

    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    const res = await fetch('/api/student-enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        studyId,
        bcqAnswers: Object.entries(bcqAnswers).map(([questionId, responseValue]) => ({ questionId, responseValue }))
      })
    })

    const data = await res.json()
    if (!res.ok) { setError(data.error); setSubmitting(false); return }

    setParticipantId(data.participantId)

    // Fetch condition and survey questions
    const { data: cond } = await supabase.from('conditions').select('*').eq('id', data.conditionId).single()
    setCondition(cond)

    const { data: qs } = await supabase
      .from('survey_questions').select('*').eq('condition_id', data.conditionId).order('order_index')
    const pre = qs?.filter((q: SurveyQuestion) => q.survey_type === 'pre') || []
    const post = qs?.filter((q: SurveyQuestion) => q.survey_type === 'post') || []
    setPreQuestions(pre)
    setPostQuestions(post)

    setVisibleSteps(buildStepLabels(bcqQuestions, pre, post, !data.alreadyEnrolled))

    setSubmitting(false)
    setStep(pre.length > 0 ? 'pre_survey' : 'course')
  }

  // ── Pre-survey ────────────────────────────────────────────────
  async function handlePreSurveySubmit() {
    setSubmitting(true)
    setError('')

    const missing = preQuestions.filter(q => q.is_required && !surveyAnswers[q.id])
    if (missing.length > 0) {
      setError('Please answer all required questions.')
      setSubmitting(false)
      return
    }

    await supabase.from('survey_responses').upsert(
      preQuestions.map(q => ({ participant_id: participantId, question_id: q.id, response_value: surveyAnswers[q.id] || '' }))
    )
    await supabase.from('participants').update({ completed_pre_survey: true }).eq('id', participantId)

    setSubmitting(false)
    setStep('course')
  }

  // ── Course complete ───────────────────────────────────────────
  async function handleCourseComplete() {
    setSubmitting(true)
    await supabase.from('participants').update({ completed_course: true }).eq('id', participantId)
    setSubmitting(false)

    if (postQuestions.length > 0) {
      setStep('post_survey')
    } else {
      router.push('/student/portal')
    }
  }

  // ── Post-survey ───────────────────────────────────────────────
  async function handlePostSurveySubmit() {
    setSubmitting(true)
    setError('')

    const missing = postQuestions.filter(q => q.is_required && !surveyAnswers[q.id])
    if (missing.length > 0) {
      setError('Please answer all required questions.')
      setSubmitting(false)
      return
    }

    await supabase.from('survey_responses').upsert(
      postQuestions.map(q => ({ participant_id: participantId, question_id: q.id, response_value: surveyAnswers[q.id] || '' }))
    )
    await supabase.from('participants').update({ completed_post_survey: true }).eq('id', participantId)
    setSubmitting(false)
    router.push('/student/portal')
  }

  // ── Step index for progress bar ──────────────────────────────
  const STEP_TO_LABEL: Record<CourseStep, string> = {
    loading: '', disqualified: '', bcq: 'Background Check', consent: 'Consent',
    pre_survey: 'Pre-Survey', course: 'Course', post_survey: 'Post-Survey'
  }
  const currentLabel = STEP_TO_LABEL[step]
  const stepIndex = visibleSteps.indexOf(currentLabel)

  if (step === 'loading') {
    return <div className="max-w-2xl mx-auto px-4 py-20 text-center text-slate-400">Loading…</div>
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 pb-20">
      <Link href="/student/portal"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 mb-6 transition-colors">
        ← My Courses
      </Link>

      {/* Progress indicator */}
      {visibleSteps.length > 0 && step !== 'disqualified' && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            {visibleSteps.map((s, i) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                  ${i < stepIndex ? 'bg-blue-600 border-blue-600 text-white'
                    : i === stepIndex ? 'border-blue-600 text-blue-600'
                    : 'border-slate-300 text-slate-400'}`}>
                  {i < stepIndex ? '✓' : i + 1}
                </div>
                {i < visibleSteps.length - 1 && (
                  <div className={`h-0.5 flex-1 ${i < stepIndex ? 'bg-blue-600' : 'bg-slate-200'}`} />
                )}
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-500">
            Step {stepIndex + 1} of {visibleSteps.length}:{' '}
            <span className="font-medium text-slate-700">{currentLabel}</span>
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-8">

        {/* ── Background Check ── */}
        {step === 'bcq' && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-1">Eligibility Questions</h2>
            <p className="text-slate-500 text-sm mb-6">
              Please answer the following questions. Only students who meet the criteria for this study will be enrolled.
            </p>
            <div className="space-y-6">
              {bcqQuestions.map(q => (
                <QuestionRenderer
                  key={q.id}
                  question={q as QuestionLike}
                  value={bcqAnswers[q.id] || ''}
                  onChange={v => { setBcqAnswers(prev => ({ ...prev, [q.id]: v })); setError('') }}
                />
              ))}
            </div>
            {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
            <button onClick={handleBCQContinue}
              className="mt-6 w-full bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors">
              Continue →
            </button>
          </div>
        )}

        {/* ── Disqualified ── */}
        {step === 'disqualified' && (
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🔍</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Not a match for this course</h2>
            <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">
              Based on your responses, you don't meet the eligibility criteria for this study.
              You're welcome to explore other available courses.
            </p>
            <Link href="/student/portal"
              className="inline-block bg-blue-600 text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors">
              Browse Other Courses →
            </Link>
          </div>
        )}

        {/* ── Consent ── */}
        {step === 'consent' && study && (
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
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            <button
              onClick={handleConsent}
              disabled={!consentChecked || submitting}
              className="w-full bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {submitting ? 'Enrolling…' : 'I Agree — Enroll Me →'}
            </button>
          </div>
        )}

        {/* ── Pre-Survey ── */}
        {step === 'pre_survey' && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-1">Pre-Course Survey</h2>
            <p className="text-slate-500 text-sm mb-6">A few quick questions before you begin.</p>
            <div className="space-y-6">
              {preQuestions.map(q => (
                <QuestionRenderer
                  key={q.id}
                  question={q}
                  value={surveyAnswers[q.id] || ''}
                  onChange={v => setSurveyAnswers(prev => ({ ...prev, [q.id]: v }))}
                />
              ))}
            </div>
            {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
            <button onClick={handlePreSurveySubmit} disabled={submitting}
              className="mt-8 w-full bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {submitting ? 'Saving…' : 'Submit & Continue →'}
            </button>
          </div>
        )}

        {/* ── Course ── */}
        {step === 'course' && condition && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Your Course</h2>
            <p className="text-slate-500 text-sm mb-6">
              Take your time with the material. Click the button below when you are done.
            </p>
            <CourseEmbed url={condition.course_url} />
            <button onClick={handleCourseComplete} disabled={submitting}
              className="mt-6 w-full bg-green-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
              {submitting ? 'Saving…' : "I've finished the course →"}
            </button>
          </div>
        )}

        {/* ── Post-Survey ── */}
        {step === 'post_survey' && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-1">Post-Course Survey</h2>
            <p className="text-slate-500 text-sm mb-6">Almost done! Tell us what you thought.</p>
            <div className="space-y-6">
              {postQuestions.map(q => (
                <QuestionRenderer
                  key={q.id}
                  question={q}
                  value={surveyAnswers[q.id] || ''}
                  onChange={v => setSurveyAnswers(prev => ({ ...prev, [q.id]: v }))}
                />
              ))}
            </div>
            {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
            <button onClick={handlePostSurveySubmit} disabled={submitting}
              className="mt-8 w-full bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {submitting ? 'Saving…' : 'Submit & Finish →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

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
