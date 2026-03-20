'use client'

import { useState } from 'react'
import VerifyCardTemplateToggle from './VerifyCardTemplateToggle'

type Props = {
  title: string
  subtitle: string
  status: string
  signer: string
  signature: string
  facts: React.ReactNode
  payload: string
}

export default function VerifyCardShell({
  title,
  subtitle,
  status,
  signer,
  signature,
  facts,
  payload,
}: Props) {
  const [template, setTemplate] = useState<'brief' | 'technical'>('brief')

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <VerifyCardTemplateToggle value={template} onChange={setTemplate} />
        <div className="rounded-full border border-slate-200/80 px-3 py-2 text-xs uppercase tracking-[0.24em] text-slate-500 dark:border-slate-700 dark:text-slate-300">
          Template {template}
        </div>
      </div>

      <article
        className={`print-card rounded-[1.75rem] border p-5 transition dark:border-slate-800 ${
          template === 'brief'
            ? 'border-slate-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] dark:bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_36%),linear-gradient(180deg,rgba(2,6,23,0.86),rgba(15,23,42,0.82))]'
            : 'border-slate-200/70 bg-slate-950 text-slate-100'
        }`}
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div
              className={`text-xs uppercase tracking-[0.28em] ${
                template === 'brief'
                  ? 'text-slate-500 dark:text-slate-400'
                  : 'text-slate-400'
              }`}
            >
              POD card
            </div>
            <h2
              className={`mt-2 text-2xl font-semibold ${
                template === 'brief'
                  ? 'text-slate-950 dark:text-white'
                  : 'text-white'
              }`}
            >
              {title}
            </h2>
            <div
              className={`mt-1 text-sm ${
                template === 'brief'
                  ? 'text-slate-600 dark:text-slate-300'
                  : 'text-slate-300'
              }`}
            >
              {subtitle}
            </div>
          </div>
          <div
            className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.22em] ${
              template === 'brief'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/80 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'border-emerald-700/80 bg-emerald-950/40 text-emerald-300'
            }`}
          >
            {status}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div
            className={`rounded-2xl border p-4 ${
              template === 'brief'
                ? 'border-slate-200/70 bg-white/80 dark:border-slate-800 dark:bg-slate-950/50'
                : 'border-slate-800 bg-slate-900'
            }`}
          >
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Signer
            </div>
            <div className="mt-2 break-all text-sm font-medium">{signer}</div>
          </div>
          <div
            className={`rounded-2xl border p-4 ${
              template === 'brief'
                ? 'border-slate-200/70 bg-white/80 dark:border-slate-800 dark:bg-slate-950/50'
                : 'border-slate-800 bg-slate-900'
            }`}
          >
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Signature
            </div>
            <div className="mt-2 break-all text-sm font-medium">{signature}</div>
          </div>
        </div>

        <div className="mt-4">{facts}</div>

        {template === 'technical' ? (
          <pre className="mt-4 overflow-auto rounded-2xl border border-slate-800 bg-black/30 p-4 text-xs leading-6 text-slate-200">
            {payload}
          </pre>
        ) : null}
      </article>
    </div>
  )
}
