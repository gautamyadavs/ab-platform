'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Enrollment {
  participantId: string
  studyId: string
  studyTitle: string
  studyDescription: string
  studyStatus: string
  completedCourse: boolean
}

interface AvailableStudy {
  id: string
  title: string
  description: string
}

export default function StudentPortalPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [available, setAvailable] = useState<AvailableStudy[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const userEmail = user.email!.toLowerCase().trim()

    const { data: participants } = await supabase
      .from('participants')
      .select('id, study_id, completed_course, studies(id, title, description, status)')
      .eq('email', userEmail)

    const enrolled: Enrollment[] = (participants || []).map((p: any) => ({
      participantId: p.id,
      studyId: p.study_id,
      studyTitle: p.studies?.title || '',
      studyDescription: p.studies?.description || '',
      studyStatus: p.studies?.status || '',
      completedCourse: p.completed_course
    }))
    setEnrollments(enrolled)

    const enrolledIds = new Set(enrolled.map(e => e.studyId))

    const { data: activeStudies } = await supabase
      .from('studies')
      .select('id, title, description')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    setAvailable((activeStudies || []).filter(s => !enrolledIds.has(s.id)))
    setLoading(false)
  }

  if (loading) {
    return <div className="max-w-3xl mx-auto px-6 py-20 text-center text-slate-400">Loading…</div>
  }

  const inProgress = enrollments.filter(e => !e.completedCourse && e.studyStatus === 'active')
  const completed = enrollments.filter(e => e.completedCourse)

  const noContent = available.length === 0 && inProgress.length === 0 && completed.length === 0

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">My Learning Portal</h1>
        <p className="text-slate-500 text-sm mt-1">Enroll in free courses and help researchers understand learning.</p>
      </div>

      {noContent && (
        <div className="text-center py-20">
          <p className="text-4xl mb-3">📚</p>
          <p className="font-medium text-slate-600">No courses available yet</p>
          <p className="text-sm text-slate-400 mt-1">Check back soon — new courses are added regularly.</p>
        </div>
      )}

      {/* Available courses */}
      {available.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Available Courses</h2>
          <div className="space-y-3">
            {available.map(s => (
              <div key={s.id} className="bg-white rounded-2xl border border-blue-100 shadow-sm p-5 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900">{s.title}</h3>
                  {s.description && (
                    <p className="text-sm text-slate-500 mt-0.5 line-clamp-1">{s.description}</p>
                  )}
                </div>
                <Link href={`/student/courses/${s.id}`}
                  className="flex-shrink-0 bg-blue-600 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors">
                  Enroll →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* In progress */}
      {inProgress.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">In Progress</h2>
          <div className="space-y-3">
            {inProgress.map(e => (
              <div key={e.participantId} className="bg-white rounded-2xl border border-blue-100 shadow-sm p-5 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900">{e.studyTitle}</h3>
                  {e.studyDescription && (
                    <p className="text-sm text-slate-500 mt-0.5 line-clamp-1">{e.studyDescription}</p>
                  )}
                </div>
                <Link href={`/student/courses/${e.studyId}`}
                  className="flex-shrink-0 bg-blue-600 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors">
                  Continue →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Completed</h2>
          <div className="space-y-3">
            {completed.map(e => (
              <div key={e.participantId} className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-slate-700">{e.studyTitle}</h3>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      Completed
                    </span>
                  </div>
                  {e.studyDescription && (
                    <p className="text-sm text-slate-400 mt-0.5 line-clamp-1">{e.studyDescription}</p>
                  )}
                </div>
                <div className="text-green-500 text-xl">✓</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
