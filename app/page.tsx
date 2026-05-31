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
        <div className="flex items-center gap-4">
          <Link href="/auth/login" className="text-sm text-slate-600 hover:text-slate-900">Researcher Login</Link>
          <Link href="/courses" className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            Browse Courses
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-8">
        <div className="text-center max-w-2xl">
          <div className="inline-block bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full mb-6">
            Research-backed learning
          </div>
          <h1 className="text-5xl font-bold text-slate-900 leading-tight mb-6">
            Free courses that<br />advance science
          </h1>
          <p className="text-lg text-slate-500 mb-10 max-w-lg mx-auto leading-relaxed">
            Take free courses while helping researchers understand how people learn.
            Every enrollment contributes to real educational science.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/courses"
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors">
              Find a Course →
            </Link>
            <Link href="/auth/signup"
              className="text-slate-600 px-6 py-3 rounded-xl font-medium border border-slate-200 hover:border-slate-400 transition-colors bg-white">
              I'm a Researcher
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
