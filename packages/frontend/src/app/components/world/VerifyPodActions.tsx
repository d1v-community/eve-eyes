'use client'

import { Check, Copy, Printer, Share2 } from 'lucide-react'
import { useState } from 'react'

type Props = {
  sharePath: string
  copyText: string
}

export default function VerifyPodActions({ sharePath, copyText }: Props) {
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)
  const [printed, setPrinted] = useState(false)

  const shareUrl =
    typeof window === 'undefined'
      ? sharePath
      : `${window.location.origin}${sharePath}`

  const copy = async () => {
    await navigator.clipboard.writeText(copyText)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const share = async () => {
    if (navigator.share) {
      await navigator.share({
        title: 'Verified EVE Frontier POD card',
        text: 'Check this verified World API POD card.',
        url: shareUrl,
      })
    } else {
      await navigator.clipboard.writeText(shareUrl)
    }

    setShared(true)
    setTimeout(() => setShared(false), 1800)
  }

  const print = () => {
    window.print()
    setPrinted(true)
    setTimeout(() => setPrinted(false), 1800)
  }

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={() => void copy()}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? 'Copied' : 'Copy card data'}
      </button>
      <button
        type="button"
        onClick={() => void share()}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200"
      >
        {shared ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
        {shared ? 'Shared' : 'Share card'}
      </button>
      <button
        type="button"
        onClick={print}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200"
      >
        {printed ? <Check className="h-4 w-4" /> : <Printer className="h-4 w-4" />}
        {printed ? 'Print ready' : 'Print / export'}
      </button>
    </div>
  )
}
