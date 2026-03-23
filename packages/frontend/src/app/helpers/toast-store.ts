'use client'

import { ReactNode } from 'react'
import type { NotificationItem, NotificationTone } from '../components/Notification'

type ShowToastInput = {
  id?: string
  type: NotificationTone
  message: ReactNode
  duration?: number
}

const EXIT_DELAY_MS = 220
const listeners = new Set<() => void>()
const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>()
const removeTimers = new Map<string, ReturnType<typeof setTimeout>>()

let toastItems: NotificationItem[] = []

function emit() {
  for (const listener of listeners) {
    listener()
  }
}

function clearManagedTimers(id: string) {
  const dismissTimer = dismissTimers.get(id)
  if (dismissTimer) {
    clearTimeout(dismissTimer)
    dismissTimers.delete(id)
  }

  const removeTimer = removeTimers.get(id)
  if (removeTimer) {
    clearTimeout(removeTimer)
    removeTimers.delete(id)
  }
}

function scheduleDismiss(id: string, duration?: number) {
  if (duration == null || !Number.isFinite(duration) || duration <= 0) {
    return
  }

  const dismissTimer = setTimeout(() => {
    dismissToast(id)
  }, duration)

  dismissTimers.set(id, dismissTimer)
}

export function subscribeToToasts(listener: () => void) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function getToastSnapshot() {
  return toastItems
}

export function showToast(input: ShowToastInput) {
  const id = input.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  clearManagedTimers(id)

  const nextItem: NotificationItem = {
    id,
    type: input.type,
    message: input.message,
    visible: true,
  }

  const existingIndex = toastItems.findIndex((item) => item.id === id)

  if (existingIndex >= 0) {
    toastItems = toastItems.map((item, index) => (index === existingIndex ? nextItem : item))
  } else {
    toastItems = [...toastItems, nextItem]
  }

  emit()
  scheduleDismiss(id, input.duration)

  return id
}

export function dismissToast(id?: string) {
  const ids = id ? [id] : toastItems.map((item) => item.id)

  ids.forEach((toastId) => {
    clearManagedTimers(toastId)

    toastItems = toastItems.map((item) =>
      item.id === toastId ? { ...item, visible: false } : item
    )

    const removeTimer = setTimeout(() => {
      toastItems = toastItems.filter((item) => item.id !== toastId)
      removeTimers.delete(toastId)
      emit()
    }, EXIT_DELAY_MS)

    removeTimers.set(toastId, removeTimer)
  })

  emit()
}
