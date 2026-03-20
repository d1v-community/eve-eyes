'use client'

type Props = {
  value: 'brief' | 'technical'
  onChange: (value: 'brief' | 'technical') => void
}

export default function VerifyCardTemplateToggle({ value, onChange }: Props) {
  return (
    <div className="inline-flex rounded-full border border-slate-200/80 bg-white/80 p-1 dark:border-slate-800 dark:bg-slate-950/60">
      <button
        type="button"
        onClick={() => onChange('brief')}
        className={`rounded-full px-4 py-2 text-sm font-medium transition ${
          value === 'brief'
            ? 'bg-sky-600 text-white'
            : 'text-slate-600 hover:text-sky-700 dark:text-slate-300 dark:hover:text-sky-300'
        }`}
      >
        Brief card
      </button>
      <button
        type="button"
        onClick={() => onChange('technical')}
        className={`rounded-full px-4 py-2 text-sm font-medium transition ${
          value === 'technical'
            ? 'bg-sky-600 text-white'
            : 'text-slate-600 hover:text-sky-700 dark:text-slate-300 dark:hover:text-sky-300'
        }`}
      >
        Technical card
      </button>
    </div>
  )
}
