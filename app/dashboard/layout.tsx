'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [email, setEmail] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/auth/login')
      } else {
        setEmail(data.user.email || '')
      }
    })
  }, [router])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-slate-200 flex flex-col fixed h-full">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">AB</span>
            </div>
            <span className="text-slate-900 font-bold text-sm">LearnLab</span>
          </div>
        </div>

        <nav className="p-3 flex-1">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-3 mb-2">Research</p>
          <NavLink href="/dashboard" label="Studies" icon="📋" active={pathname === '/dashboard'} />
          <NavLink href="/courses" label="Student Portal ↗" icon="🎓" active={false} />
        </nav>

        <div className="p-4 border-t border-slate-100">
          <p className="text-xs text-slate-400 truncate mb-2">{email}</p>
          <button onClick={handleSignOut}
            className="text-xs text-slate-500 hover:text-red-500 transition-colors">
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-56 p-8">
        {children}
      </main>
    </div>
  )
}

function NavLink({ href, label, icon, active }: { href: string; label: string; icon: string; active: boolean }) {
  return (
    <Link href={href}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors
        ${active ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
      <span>{icon}</span>
      {label}
    </Link>
  )
}
