import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex flex-col">
      <header className="px-8 py-5 flex items-center justify-between max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">AB</span>
          </div>
          <span className="font-bold text-slate-900">LearnLab</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="text-center mb-12">
          <div className="inline-block bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full mb-5">
            Research-backed learning
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-3">Welcome to LearnLab</h1>
          <p className="text-slate-500 max-w-md mx-auto">
            Free courses for learners. A/B experiment tools for researchers.
          </p>
        </div>

        <p className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-6">Who are you?</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">
          {/* Student card */}
          <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-7 flex flex-col">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 text-2xl">
              📚
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">I'm a Student</h2>
            <p className="text-sm text-slate-500 mb-6 flex-1">
              Take free courses and help researchers understand how people learn.
            </p>
            <div className="space-y-2">
              <Link href="/student/login"
                className="block w-full text-center bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors">
                Sign In
              </Link>
              <Link href="/student/signup"
                className="block w-full text-center border border-blue-200 text-blue-600 rounded-xl py-2.5 text-sm font-medium hover:border-blue-400 hover:bg-blue-50 transition-colors">
                Create Account
              </Link>
            </div>
          </div>

          {/* Researcher card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-7 flex flex-col">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mb-4 text-2xl">
              🔬
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">I'm a Researcher</h2>
            <p className="text-sm text-slate-500 mb-6 flex-1">
              Create and manage A/B learning studies. Analyze participant data.
            </p>
            <div className="space-y-2">
              <Link href="/auth/login"
                className="block w-full text-center bg-slate-800 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-slate-900 transition-colors">
                Sign In
              </Link>
              <Link href="/auth/signup"
                className="block w-full text-center border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm font-medium hover:border-slate-400 hover:bg-slate-50 transition-colors">
                Create Account
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
