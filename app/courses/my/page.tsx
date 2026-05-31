'use client'
import { useState } from 'react'
import Link from 'next/link'

interface CourseEnrollment {
  participantId: string
  studyId: string
  studyTitle: string
  studyDescription: string
  studyStatus: string
  conditionLabel: string
  consentGiven: boolean
  completedPreSurvey: boolean
  completedCourse: boolean
  completedPostSurvey: boolean
  enrolledAt: string
}

function ProgressStep({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
        ${done ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
        {done ? '✓' : '·'}
      </div>
      <span className={`text-xs ${done ? 'text-slate-700' : 'text-slate-400'}`}>{label}</span>
    </div>
  )
}

function getNextStep(c: CourseEnrollment): string {
  if (!c.consentGiven) return 'Give consent'
  if (!c.completedPreSurvey) return 'Complete pre-survey'
  if (!c.completedCourse) return 'Continue course'
  if (!c.completedPostSurvey) return 'Complete post-survey'
  return 'Completed'
}

function isCompleted(c: CourseEnrollment) {
  return c.consentGiven && c.completedPreSurvey && c.completedCourse && c.completedPostSurvey
}

export default function MyCoursesPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [courses, setCourses] = useState<CourseEnrollment[]>([])
  const [error, setError] = useState('')

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch(`/api/student?email=${encodeURIComponent(email)}`)
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Something went wrong.')
      setLoading(false)
      return
    }

    setCourses(data.courses)
    setSubmitted(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-blue-50 pb-20">
      <header className="bg-white border-b border-blue-100 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">AB</span>
            </div>
            <span className="text-slate-900 font-bold text-sm">LearnLab</span>
          </div>
          <Link href="/courses" className="text-sm text-blue-600 hover:underline">
            Browse Courses
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">My Courses</h1>
          <p className="text-slate-500">Enter your email to see your enrolled courses and progress.</p>
        </div>

        <form onSubmit={handleLookup} className="bg-white rounded-2xl border border-blue-100 shadow-sm p-6 mb-8">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Your email address
          </label>
          <div className="flex gap-3">
            <input
              type="email"
              required
              value={email}
              onChange={e => { setEmail(e.target.value); setSubmitted(false) }}
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="your@email.com"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Looking up…' : 'Look up'}
            </button>
          </div>
          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
        </form>

        {submitted && (
          courses.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <p className="text-4xl mb-3">📭</p>
              <p className="font-medium text-slate-600">No courses found</p>
              <p className="text-sm mt-1">No enrollments found for <span className="font-medium">{email}</span>.</p>
              <Link href="/courses"
                className="inline-block mt-6 bg-blue-600 text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors">
                Browse Available Courses →
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">{courses.length} course{courses.length > 1 ? 's' : ''} found for <span className="font-medium text-slate-700">{email}</span></p>
              {courses.map(course => {
                const done = isCompleted(course)
                const nextStep = getNextStep(course)
                const isActive = course.studyStatus === 'active'

                return (
                  <div key={course.participantId}
                    className="bg-white rounded-2xl border border-blue-100 shadow-sm p-6">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h2 className="font-semibold text-slate-900">{course.studyTitle}</h2>
                          {done && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                              Completed
                            </span>
                          )}
                          {!isActive && !done && (
                            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium capitalize">
                              {course.studyStatus}
                            </span>
                          )}
                        </div>
                        {course.studyDescription && (
                          <p className="text-sm text-slate-500 line-clamp-2">{course.studyDescription}</p>
                        )}
                        <p className="text-xs text-slate-400 mt-1">
                          Enrolled {new Date(course.enrolledAt).toLocaleDateString()}
                        </p>
                      </div>

                      {isActive && !done && (
                        <Link
                          href={`/courses/${course.studyId}`}
                          className="flex-shrink-0 bg-blue-600 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors">
                          Continue →
                        </Link>
                      )}
                    </div>

                    {/* Progress steps */}
                    <div className="border-t border-slate-100 pt-4">
                      <p className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wide">Progress</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <ProgressStep label="Consent" done={course.consentGiven} />
                        <ProgressStep label="Pre-survey" done={course.completedPreSurvey} />
                        <ProgressStep label="Course" done={course.completedCourse} />
                        <ProgressStep label="Post-survey" done={course.completedPostSurvey} />
                      </div>
                      {!done && isActive && (
                        <p className="text-xs text-blue-600 mt-3 font-medium">Next: {nextStep}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </main>

      <Link href="/courses"
        className="fixed bottom-6 left-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-600 rounded-lg px-4 py-2 shadow-sm transition-colors z-10">
        ← All Courses
      </Link>
    </div>
  )
}
