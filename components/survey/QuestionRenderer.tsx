'use client'
import { QuestionType, LikertOptions, ChoiceOptions } from '@/lib/types'

export interface QuestionLike {
  id: string
  question_text: string
  question_type: QuestionType
  options_json: LikertOptions | ChoiceOptions | null
  is_required?: boolean
}

export function QuestionRenderer({ question, value, onChange }: {
  question: QuestionLike
  value: string
  onChange: (v: string) => void
}) {
  const opts = question.options_json as any
  return (
    <div>
      <p className="text-sm font-medium text-slate-800 mb-2">
        {question.question_text}
        {question.is_required && <span className="text-red-500 ml-1">*</span>}
      </p>

      {question.question_type === 'short_text' && (
        <textarea rows={3} value={value} onChange={e => onChange(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
      )}

      {question.question_type === 'multiple_choice' && opts?.choices && (
        <div className="space-y-2">
          {opts.choices.map((c: string) => (
            <label key={c} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name={question.id} value={c} checked={value === c} onChange={() => onChange(c)}
                className="accent-blue-600" />
              <span className="text-sm text-slate-700">{c}</span>
            </label>
          ))}
        </div>
      )}

      {question.question_type === 'checkbox' && opts?.choices && (
        <div className="space-y-2">
          {opts.choices.map((c: string) => {
            const selected = value ? value.split('||') : []
            return (
              <label key={c} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={selected.includes(c)}
                  onChange={e => {
                    const next = e.target.checked ? [...selected, c] : selected.filter(s => s !== c)
                    onChange(next.join('||'))
                  }}
                  className="accent-blue-600" />
                <span className="text-sm text-slate-700">{c}</span>
              </label>
            )
          })}
        </div>
      )}

      {question.question_type === 'likert' && (
        <div>
          <div className="flex gap-2 justify-between mb-1">
            {Array.from({ length: opts?.scale || 5 }, (_, i) => i + 1).map(n => (
              <button key={n} type="button" onClick={() => onChange(String(n))}
                className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-colors
                  ${value === String(n)
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-slate-300 text-slate-600 hover:border-blue-400'}`}>
                {n}
              </button>
            ))}
          </div>
          {opts?.low_label && opts?.high_label && (
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>{opts.low_label}</span>
              <span>{opts.high_label}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
