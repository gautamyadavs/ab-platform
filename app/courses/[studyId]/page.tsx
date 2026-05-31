import { createServiceClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import EnrollmentWizard from '@/components/enrollment/EnrollmentWizard'

interface Props { params: Promise<{ studyId: string }> }

export default async function CoursePage({ params }: Props) {
  const { studyId } = await params
  const supabase = createServiceClient()

  const { data: study } = await supabase
    .from('studies')
    .select('id, title, description, consent_text, status')
    .eq('id', studyId)
    .single()

  if (!study || study.status !== 'active') notFound()

  return (
    <div className="min-h-screen bg-blue-50 pb-20">
      <header className="bg-white border-b border-blue-100 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <a href="/courses" className="text-blue-600 text-sm hover:underline">← All Courses</a>
          <span className="text-slate-300">|</span>
          <span className="text-slate-600 text-sm font-medium">{study.title}</span>
        </div>
      </header>
      <EnrollmentWizard study={study} />

      <Link href="/courses"
        className="fixed bottom-6 left-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-600 rounded-lg px-4 py-2 shadow-sm transition-colors z-10">
        ← All Courses
      </Link>
    </div>
  )
}
