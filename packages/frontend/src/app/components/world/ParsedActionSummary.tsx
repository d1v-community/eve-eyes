'use client'

import type { MouseEvent, ReactNode } from 'react'

export type ActionEntity = {
  value: string
  kind: 'object' | 'account' | 'unknown'
  label?: string | null
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getEntityHref(entity: ActionEntity) {
  if (entity.kind === 'object') {
    return `https://suiscan.xyz/testnet/object/${entity.value}/tx-blocks`
  }

  if (entity.kind === 'account') {
    return `https://suiscan.xyz/testnet/account/${entity.value}`
  }

  return null
}

function getKindClassName(kind: ActionEntity['kind']) {
  if (kind === 'object') {
    return 'border-sky-300/80 bg-sky-100/85 text-sky-900 dark:border-sky-800/80 dark:bg-sky-950/45 dark:text-sky-100'
  }

  if (kind === 'account') {
    return 'border-emerald-300/80 bg-emerald-100/85 text-emerald-900 dark:border-emerald-800/80 dark:bg-emerald-950/45 dark:text-emerald-100'
  }

  return 'border-amber-300/80 bg-amber-100/85 text-amber-900 dark:border-amber-800/80 dark:bg-amber-950/45 dark:text-amber-100'
}

function renderEntity(
  entity: ActionEntity,
  key: string,
  onClick?: (event: MouseEvent<HTMLElement>) => void
) {
  const href = getEntityHref(entity)
  const content = (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-mono text-[11px] font-semibold leading-5 shadow-[0_8px_18px_rgba(15,23,42,0.08)] transition duration-150 ${getKindClassName(entity.kind)} ${href ? 'hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(14,165,233,0.18)]' : ''}`}
      title={entity.label ? `${entity.label} · ${entity.kind}` : entity.kind}
    >
      <span className="break-all">{entity.value}</span>
      <span className="rounded-full border border-current/20 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.2em] opacity-80">
        {entity.kind}
      </span>
    </span>
  )

  if (!href) {
    return <span key={key}>{content}</span>
  }

  return (
    <a
      key={key}
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={onClick}
      className="inline-flex align-middle"
    >
      {content}
    </a>
  )
}

export function ParsedActionSummary({
  summary,
  entities = [],
  className = '',
  stopPropagation = false,
}: {
  summary: string | null | undefined
  entities?: ActionEntity[] | null
  className?: string
  stopPropagation?: boolean
}) {
  const text = summary ?? 'No parsed action summary.'
  const uniqueEntities = Array.isArray(entities)
    ? entities
        .filter((entity): entity is ActionEntity => Boolean(entity?.value))
        .sort((left, right) => right.value.length - left.value.length)
    : []

  if (uniqueEntities.length === 0) {
    return <span className={className}>{text}</span>
  }

  const pattern = new RegExp(uniqueEntities.map((entity) => escapeRegExp(entity.value)).join('|'), 'g')
  const parts: ReactNode[] = []
  let lastIndex = 0

  for (const match of text.matchAll(pattern)) {
    const value = match[0]
    const index = match.index ?? 0

    if (index > lastIndex) {
      parts.push(text.slice(lastIndex, index))
    }

    const entity =
      uniqueEntities.find((candidate) => candidate.value === value) ?? {
        value,
        kind: 'unknown' as const,
      }

    parts.push(
      renderEntity(
        entity,
        `entity-${index}-${value}`,
        stopPropagation ? (event) => event.stopPropagation() : undefined
      )
    )

    lastIndex = index + value.length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return <span className={className}>{parts}</span>
}
