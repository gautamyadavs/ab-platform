'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function CoursesRedirect() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        router.replace('/student/portal')
      } else {
        router.replace('/student/login')
      }
    })
  }, [router])

  return <div className="min-h-screen bg-blue-50" />
}
