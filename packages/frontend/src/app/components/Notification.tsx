'use client'

import c from 'clsx'
import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  Sparkles,
  XIcon,
} from 'lucide-react'
import { FC, PropsWithChildren } from 'react'
import toast, { Toast } from 'react-hot-toast'

export type NotificationTone = 'blank' | 'success' | 'error' | 'loading'

interface INotification {
  toastInstance: Toast
  type: NotificationTone
}

const toneMap = {
  blank: {
    eyebrow: 'Notice',
    icon: Sparkles,
    iconClassName: 'text-sky-700 dark:text-sky-200',
    accentClassName:
      'from-sky-200/90 via-cyan-100/80 to-transparent dark:from-sky-400/20 dark:via-cyan-300/10 dark:to-transparent',
  },
  success: {
    eyebrow: 'Success',
    icon: CheckCircle2,
    iconClassName: 'text-emerald-700 dark:text-emerald-200',
    accentClassName:
      'from-emerald-200/90 via-teal-100/80 to-transparent dark:from-emerald-400/20 dark:via-teal-300/10 dark:to-transparent',
  },
  error: {
    eyebrow: 'Alert',
    icon: AlertTriangle,
    iconClassName: 'text-rose-700 dark:text-rose-200',
    accentClassName:
      'from-rose-200/90 via-orange-100/80 to-transparent dark:from-rose-400/20 dark:via-orange-300/10 dark:to-transparent',
  },
  loading: {
    eyebrow: 'In Progress',
    icon: LoaderCircle,
    iconClassName: 'text-amber-700 dark:text-amber-200',
    accentClassName:
      'from-amber-200/90 via-yellow-100/80 to-transparent dark:from-amber-400/20 dark:via-yellow-300/10 dark:to-transparent',
  },
} satisfies Record<
  NotificationTone,
  { eyebrow: string; icon: typeof Sparkles; iconClassName: string; accentClassName: string }
>

const Notification: FC<PropsWithChildren<INotification>> = ({
  children,
  toastInstance,
  type,
}) => {
  const isCloseButtonVisible = type !== 'loading'
  const tone = toneMap[type]
  const Icon = tone.icon

  return (
    <div
      className={c(
        'group relative w-full overflow-hidden rounded-[1.6rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.94))] p-4 text-slate-950 shadow-[0_22px_60px_rgba(15,23,42,0.14)] ring-1 ring-white/65 backdrop-blur-xl transition-all duration-300 dark:border-slate-700/80 dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.94),rgba(15,23,42,0.92))] dark:text-slate-50 dark:ring-white/5 dark:shadow-[0_22px_60px_rgba(2,6,23,0.42)]',
        toastInstance.visible
          ? 'translate-y-0 scale-100 opacity-100'
          : '-translate-y-2 scale-[0.98] opacity-0'
      )}
    >
      <div
        className={c(
          'pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90',
          tone.accentClassName
        )}
      />
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-white/70 dark:bg-white/10" />
      <div className="relative flex items-start gap-3">
        <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border border-white/70 bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] dark:border-white/10 dark:bg-white/5 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <Icon
            className={c('h-5 w-5', tone.iconClassName, {
              'animate-spin': type === 'loading',
            })}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-[10px] uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">
            {tone.eyebrow}
          </div>
          <div
            className={c('sds-toast-content mt-1 text-sm leading-6 text-slate-700 dark:text-slate-200', {
              'pr-2': isCloseButtonVisible,
            })}
            style={{
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
            }}
          >
            {children}
          </div>
        </div>
        {isCloseButtonVisible ? (
          <button
            type="button"
            aria-label="Dismiss notification"
            className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200/80 bg-white/80 text-slate-500 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700/80 dark:bg-slate-900/70 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-100"
            onClick={() => toast.dismiss(toastInstance.id)}
          >
            <XIcon className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800/90">
        <div
          className={c(
            'h-full rounded-full',
            type === 'success' &&
              'bg-[linear-gradient(90deg,rgba(16,185,129,0.88),rgba(45,212,191,0.92))]',
            type === 'error' &&
              'bg-[linear-gradient(90deg,rgba(244,63,94,0.9),rgba(251,146,60,0.92))]',
            type === 'loading' &&
              'sds-toast-loading-bar bg-[linear-gradient(90deg,rgba(245,158,11,0.9),rgba(250,204,21,0.92),rgba(245,158,11,0.9))]',
            type === 'blank' &&
              'bg-[linear-gradient(90deg,rgba(14,165,233,0.9),rgba(34,211,238,0.92))]'
          )}
          style={type === 'loading' ? undefined : { width: '42%' }}
        />
      </div>
    </div>
  )
}

export default Notification
