import { createServiceClient } from '@/lib/supabase'
import Link from 'next/link'
import { Study } from '@/lib/types'


export const revalidate = 60

export default async function CoursesPage() {
  const supabase = createServiceClient()
  const { data: studies } = await supabase
    .from('studies')
    .select('id, title, description, created_at')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-blue-100 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">AB</span>
            </div>
            <h1 className="text-lg font-bold text-slate-900">LearnLab</h1>
            <span className="text-sm text-slate-400 ml-1 hidden sm:inline">Free courses for everyone</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/courses/my"
              className="text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-400 rounded-lg px-3 py-1.5 transition-colors">
              My Courses →
            </Link>
            <Link href="/dashboard"
              className="text-sm font-medium text-slate-500 hover:text-slate-700 border border-slate-200 hover:border-slate-400 rounded-lg px-3 py-1.5 transition-colors">
              Researcher Portal
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 mb-3">Free Courses</h2>
          <p className="text-slate-600 max-w-xl mx-auto">
            Enroll in any course below for free. By participating, you help researchers
            understand how people learn.
          </p>
        </div>

        {!studies || studies.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            No active courses right now. Check back soon!
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {studies.map((study) => (
              <div key={study.id} className="bg-white rounded-2xl border border-blue-100 shadow-sm p-6 flex flex-col">
                <div className="flex-1">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                    <span className="text-blue-600 text-sm">📖</span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">{study.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{study.description}</p>
                </div>
                <div className="mt-6">
                  <Link
                    href={`/courses/${study.id}`}
                    className="block w-full text-center bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    Enroll for Free →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
