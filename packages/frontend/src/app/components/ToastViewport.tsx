'use client'

import { useSyncExternalStore } from 'react'
import Notification from './Notification'
import {
  dismissToast,
  getToastSnapshot,
  subscribeToToasts,
} from '../helpers/toast-store'

export default function ToastViewport() {
  const toasts = useSyncExternalStore(subscribeToToasts, getToastSnapshot, getToastSnapshot)

  return (
    <div className="pointer-events-none fixed right-3 top-4 z-[120] flex w-[min(26rem,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)] flex-col gap-3 md:right-6 md:top-6">
      {toasts.map((item) => (
        <Notification key={item.id} item={item} onDismiss={dismissToast} />
      ))}
    </div>
  )
}
