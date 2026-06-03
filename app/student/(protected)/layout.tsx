'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [email, setEmail] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push(`/student/login?redirect=${encodeURIComponent(pathname)}`)
      } else {
        setEmail(data.user.email || '')
        setReady(true)
      }
    })
  }, [router, pathname])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/student/login')
  }

  if (!ready) return <div className="min-h-screen bg-blue-50" />

  return (
    <div className="min-h-screen bg-blue-50">
      <header className="bg-white border-b border-blue-100 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/student/portal" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">AB</span>
            </div>
            <span className="text-slate-900 font-bold text-sm">LearnLab</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/student/portal"
              className={`text-sm font-medium transition-colors ${pathname === '/student/portal' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
              My Courses
            </Link>
            <span className="text-xs text-slate-400 hidden sm:block truncate max-w-[160px]">{email}</span>
            <button onClick={handleSignOut}
              className="text-sm text-slate-500 hover:text-red-500 transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </header>
      {children}
    </div>
  )
}
