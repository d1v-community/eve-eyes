'use client'

import { Button } from '@radix-ui/themes'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  HelpCircle,
  KeyRound,
  Layers3,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import {
  type ReactNode,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'
import { notification } from '~~/helpers/notification'
import { ParsedActionSummary, type ActionEntity } from './ParsedActionSummary'

const FREE_PAGE_LIMIT = 3
const UI_PAGE_LIMIT = 30
const PAGE_SIZE = 10

type AuthType = 'loading' | 'anonymous' | 'jwt' | 'apiKey'

type PaginationPayload = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

type TransactionBlockItem = {
  id: string
  digest: string
  senderAddress: string | null
  transactionKind: string | null
  status: string | null
  checkpoint: number | null
  transactionTime: string | null
}

type MoveCallItem = {
  id: string
  txDigest: string
  callIndex: number | null
  packageId: string | null
  moduleName: string | null
  functionName: string | null
  rawCall: unknown
  senderAddress: string | null
  status: string | null
  transactionTime: string | null
  actionSummary?: string | null
  actionEntities?: ActionEntity[] | null
}

type ListingResponse<TItem> = {
  items?: TItem[]
  pagination?: PaginationPayload
  auth?: {
    type?: Exclude<AuthType, 'loading'>
  }
  error?: string
}

type Column<TItem> = {
  key: string
  label: string
  mobileLabel?: string
  render: (item: TItem) => ReactNode
  copyValue?: (item: TItem) => string | null
  allowWrap?: boolean
}

type ListingCardProps<TItem> = {
  title: string
  eyebrow: string
  description: string
  endpoint: string
  columns: Column<TItem>[]
  authType: AuthType
  refreshAuthStatus: () => Promise<AuthType>
  getItemHref?: (item: TItem) => string | null
  openItemInNewTab?: boolean
}

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000
let nowSnapshot = Date.now()

function subscribeNow(callback: () => void) {
  const intervalId = window.setInterval(() => {
    nowSnapshot = Date.now()
    callback()
  }, 1000)

  return () => {
    window.clearInterval(intervalId)
  }
}

function getNow() {
  return nowSnapshot
}

function formatRelativeTime(timestamp: number, now: number) {
  const diffInSeconds = Math.max(0, Math.floor((now - timestamp) / 1000))

  if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`
  }

  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes} min ago`
  }

  const hours = Math.floor(diffInSeconds / 3600)
  return `${hours} hour${hours === 1 ? '' : 's'} ago`
}

function truncateValue(value: string | null, start = 8, end = 6) {
  if (!value) {
    return 'Unavailable'
  }

  if (value.length <= start + end + 3) {
    return value
  }

  return `${value.slice(0, start)}...${value.slice(-end)}`
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Pending'
  }

  return dateTimeFormatter.format(new Date(value))
}

function RelativeTime({ value }: { value: string | null }) {
  const now = useSyncExternalStore(subscribeNow, getNow, getNow)
  const timestamp = useMemo(() => {
    if (!value) {
      return null
    }

    const parsed = new Date(value).getTime()
    return Number.isNaN(parsed) ? null : parsed
  }, [value])

  if (timestamp == null) {
    return 'Pending'
  }

  if (now - timestamp < ONE_DAY_IN_MS) {
    return (
      <span className="font-data" title={formatDate(value)}>
        {formatRelativeTime(timestamp, now)}
      </span>
    )
  }

  return <span className="font-data">{formatDate(value)}</span>
}

function formatStatus(value: string | null) {
  if (!value) {
    return 'Unknown'
  }

  return value.replaceAll('_', ' ')
}

function formatCount(value: number | null) {
  if (value == null) {
    return '--'
  }

  return value.toLocaleString('en-US')
}

async function parseJsonResponse<TPayload>(response: Response): Promise<TPayload> {
  const payload = (await response.json().catch(() => ({}))) as TPayload

  if (!response.ok) {
    throw new Error(
      typeof (payload as { error?: string })?.error === 'string'
        ? (payload as { error: string }).error
        : `Request failed: ${response.status}`
    )
  }

  return payload
}

type JsonToken = {
  value: string
  tone: string
}

function tokenizeJsonLine(line: string): JsonToken[] {
  const tokens: JsonToken[] = []
  const pattern =
    /("(?:\\.|[^"\\])*")(?=\s*:)|"(?:\\.|[^"\\])*"|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[[\]{},:]/g

  let lastIndex = 0

  for (const match of line.matchAll(pattern)) {
    const value = match[0]
    const index = match.index ?? 0

    if (index > lastIndex) {
      tokens.push({
        value: line.slice(lastIndex, index),
        tone: 'text-slate-500 dark:text-slate-400',
      })
    }

    let tone = 'text-slate-300'

    if (/^"/.test(value) && /^\s*:/.test(line.slice(index + value.length))) {
      tone = 'text-sky-300'
    } else if (/^"/.test(value)) {
      tone = 'text-emerald-300'
    } else if (/^(true|false)$/.test(value)) {
      tone = 'text-amber-300'
    } else if (value === 'null') {
      tone = 'text-fuchsia-300'
    } else if (/^-?\d/.test(value)) {
      tone = 'text-cyan-300'
    } else {
      tone = 'text-slate-500 dark:text-slate-400'
    }

    tokens.push({ value, tone })
    lastIndex = index + value.length
  }

  if (lastIndex < line.length) {
    tokens.push({
      value: line.slice(lastIndex),
      tone: 'text-slate-500 dark:text-slate-400',
    })
  }

  return tokens
}

function formatJsonValue(value: unknown) {
  try {
    return JSON.stringify(value, null, 2) ?? 'null'
  } catch {
    return '"[unserializable]"'
  }
}

function JsonPreview({ value }: { value: unknown }) {
  const formatted = formatJsonValue(value)
  const lines = formatted.split('\n')

  return (
    <pre className="max-h-[calc(1.5rem*5+1.5rem)] w-full max-w-[min(26rem,calc(100vw-7rem))] overflow-y-auto overflow-x-hidden rounded-[1rem] border border-slate-800 bg-slate-950/95 p-3 text-xs leading-6 shadow-[0_22px_48px_rgba(2,6,23,0.42)] lg:max-w-[28rem]">
      <code className="block whitespace-pre-wrap break-words">
        {lines.map((line, lineIndex) => (
          <div
            key={`json-line-${lineIndex}`}
            className="max-w-full whitespace-pre-wrap break-words"
          >
            {tokenizeJsonLine(line).map((token, tokenIndex) => (
              <span
                key={`json-line-${lineIndex}-token-${tokenIndex}`}
                className={`${token.tone} whitespace-pre-wrap break-words`}
              >
                {token.value}
              </span>
            ))}
          </div>
        ))}
      </code>
    </pre>
  )
}

function RawCallPreview({ item }: { item: MoveCallItem }) {
  return (
    <div className="group/raw relative inline-flex max-w-full">
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex cursor-default items-center rounded-full border border-sky-200/80 bg-sky-50/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700 dark:border-sky-900/80 dark:bg-sky-950/35 dark:text-sky-200">
          Inspect
        </span>
        {/* <span className="rounded-full border border-slate-300/80 bg-white/80 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-slate-600 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300">
          call #{item.callIndex ?? '--'}
        </span> */}
      </div>

      <div className="pointer-events-none invisible absolute left-0 top-full z-30 mt-3 w-[min(26rem,calc(100vw-3rem))] max-w-[calc(100vw-3rem)] -translate-y-1 rounded-[1.2rem] border border-slate-700/90 bg-[linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] p-4 opacity-0 shadow-[0_28px_80px_rgba(2,6,23,0.48)] transition-all duration-150 group-hover/raw:pointer-events-auto group-hover/raw:visible group-hover/raw:translate-y-0 group-hover/raw:opacity-100 sm:w-[min(28rem,calc(100vw-4rem))]">
        <div className="mb-3 flex flex-wrap gap-2">
          <span className="rounded-full border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-slate-300">
            {item.moduleName ?? 'unknown'}::{item.functionName ?? 'unknown'}
          </span>
        </div>
        <JsonPreview value={item.rawCall} />
      </div>
    </div>
  )
}

function getPaginationButtonClassName(isActive = false) {
  return `!rounded-full !px-3.5 !transition-all !duration-200 hover:-translate-y-0.5 hover:!shadow-[0_14px_26px_rgba(14,165,233,0.16)] active:scale-95 ${isActive
    ? '!shadow-[0_16px_30px_rgba(14,165,233,0.2)]'
    : '!bg-white/85 hover:!bg-sky-50 dark:!bg-slate-950/60 dark:hover:!bg-slate-900'
    }`
}

function buildPageWindow(currentPage: number, totalPages: number) {
  const visibleTotal = Math.min(totalPages, UI_PAGE_LIMIT)
  const start = Math.max(1, currentPage - 2)
  const end = Math.min(visibleTotal, start + 4)
  const normalizedStart = Math.max(1, end - 4)
  const pages = []

  for (let page = normalizedStart; page <= end; page += 1) {
    pages.push(page)
  }

  return pages
}

function getStatusTone(status: string | null) {
  const normalized = (status ?? '').toLowerCase()

  if (normalized.includes('success')) {
    return 'border-emerald-300/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200'
  }

  if (normalized.includes('fail') || normalized.includes('error')) {
    return 'border-red-300/80 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200'
  }

  return 'border-slate-300/80 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200'
}

function renderStatusPill(status: string | null) {
  return (
    <span
      className={`font-display inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${getStatusTone(status)}`}
    >
      {formatStatus(status)}
    </span>
  )
}

function renderStatusIcon(status: string | null) {
  const normalized = (status ?? '').toLowerCase()

  if (normalized.includes('success')) {
    return (
      <span
        title={formatStatus(status)}
        aria-label={formatStatus(status)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-300/80 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
      >
        <CheckCircle2 className="h-4.5 w-4.5" />
      </span>
    )
  }

  if (normalized.includes('fail') || normalized.includes('error')) {
    return (
      <span
        title={formatStatus(status)}
        aria-label={formatStatus(status)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-300/80 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
      >
        <XCircle className="h-4.5 w-4.5" />
      </span>
    )
  }

  return (
    <span
      title={formatStatus(status)}
      aria-label={formatStatus(status)}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300/80 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300"
    >
      <HelpCircle className="h-4.5 w-4.5" />
    </span>
  )
}

function LoadingRows({ columnCount }: { columnCount: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, rowIndex) => (
        <tr key={`loading-${rowIndex}`} className="animate-pulse">
          {Array.from({ length: columnCount }).map((__, columnIndex) => (
            <td
              key={`loading-cell-${rowIndex}-${columnIndex}`}
              className="border-b border-slate-200/70 px-4 py-4 dark:border-slate-800"
            >
              <div className="h-4 rounded-full bg-slate-200/80 dark:bg-slate-800" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

function ListingCard<TItem>({
  title,
  eyebrow,
  description,
  endpoint,
  columns,
  authType,
  refreshAuthStatus,
  getItemHref,
  openItemInNewTab = false,
}: ListingCardProps<TItem>) {
  const router = useRouter()
  const [items, setItems] = useState<TItem[]>([])
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<PaginationPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPageTransitioning, setIsPageTransitioning] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [hintMessage, setHintMessage] = useState<string | null>(null)

  const loadPage = useCallback(
    async (targetPage: number, options?: { preserveContent?: boolean }) => {
      setErrorMessage(null)
      setHintMessage(null)

      if (targetPage > UI_PAGE_LIMIT) {
        setHintMessage('Pages beyond 30 are available through the API.')
        return
      }

      if (targetPage > FREE_PAGE_LIMIT) {
        const nextAuthType = await refreshAuthStatus()

        if (nextAuthType === 'anonymous') {
          setHintMessage('Pages 4 and above require an authenticated session.')
          return
        }
      }

      setIsLoading(true)
      setIsPageTransitioning(options?.preserveContent === true)

      try {
        const response = await fetch(`${endpoint}?page=${targetPage}&pageSize=${PAGE_SIZE}`, {
          cache: 'no-store',
        })

        if (response.status === 401) {
          await refreshAuthStatus()
          setHintMessage('Pages 4 and above require an authenticated session.')
          return
        }

        const payload = await parseJsonResponse<ListingResponse<TItem>>(response)
        setItems(payload.items ?? [])
        setPagination(payload.pagination ?? null)
        setPage(targetPage)

        if (targetPage === UI_PAGE_LIMIT && (payload.pagination?.totalPages ?? 0) > UI_PAGE_LIMIT) {
          setHintMessage('This interface shows the first 30 pages. Use the API for deeper pagination.')
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load data')
      } finally {
        setIsLoading(false)
        setIsPageTransitioning(false)
      }
    },
    [endpoint, refreshAuthStatus]
  )

  useEffect(() => {
    startTransition(() => {
      loadPage(1).catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load data')
        setIsLoading(false)
      })
    })
  }, [loadPage])

  const totalPages = pagination?.totalPages ?? 1
  const visibleTotalPages = Math.min(totalPages, UI_PAGE_LIMIT)
  const pageWindow = buildPageWindow(page, totalPages)
  const gatedPagesCount = Math.max(0, visibleTotalPages - FREE_PAGE_LIMIT)
  const visibleRecordCount = items.length

  return (
    <article className="relative overflow-hidden rounded-[1.8rem] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] p-5 shadow-[0_22px_70px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.92),rgba(15,23,42,0.82))] md:p-6">
      <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-sky-300 to-transparent opacity-80" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-display inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/85 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-sky-700 dark:border-sky-900/80 dark:bg-sky-950/40 dark:text-sky-200">
            <Layers3 className="h-3.5 w-3.5" />
            {eyebrow}
          </div>
          <h3 className="font-display mt-4 text-[1.7rem] font-semibold tracking-[-0.045em] text-slate-950 dark:text-white md:text-[1.95rem]">
            {title}
          </h3>
          <p className="font-body mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            {description}
          </p>
        </div>

        <Button
          type="button"
          variant="soft"
          onClick={() => {
            startTransition(() => {
              loadPage(page, { preserveContent: items.length > 0 }).catch((error) => {
                setErrorMessage(error instanceof Error ? error.message : 'Failed to refresh data')
                setIsLoading(false)
                setIsPageTransitioning(false)
              })
            })
          }}
          disabled={isLoading}
          className="!rounded-full"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <div className="rounded-[1.2rem] border border-slate-200/80 bg-white/85 p-4 dark:border-slate-800 dark:bg-slate-950/55">
          <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            Current Page
          </div>
          <div className="font-display mt-2 text-3xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white">
            {page}
          </div>
          <div className="font-body mt-1 text-sm text-slate-600 dark:text-slate-300">
            of {visibleTotalPages}
          </div>
        </div>

        <div className="rounded-[1.2rem] border border-slate-200/80 bg-white/85 p-4 dark:border-slate-800 dark:bg-slate-950/55">
          <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            Indexed Records
          </div>
          <div className="font-display mt-2 text-3xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white">
            {formatCount(pagination?.total ?? null)}
          </div>
          <div className="font-body mt-1 text-sm text-slate-600 dark:text-slate-300">
            {PAGE_SIZE} per page
          </div>
        </div>

        <div className="rounded-[1.2rem] border border-slate-200/80 bg-white/85 p-4 dark:border-slate-800 dark:bg-slate-950/55">
          <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            Access Window
          </div>
          <div className="font-display mt-2 text-3xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white">
            1-3
          </div>
          <div className="font-body mt-1 text-sm text-slate-600 dark:text-slate-300">
            public pages
          </div>
        </div>

        <div className="rounded-[1.2rem] border border-slate-200/80 bg-white/85 p-4 dark:border-slate-800 dark:bg-slate-950/55">
          <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            Session State
          </div>
          <div className="mt-2 flex items-center gap-2">
            {authType === 'anonymous'
              ? renderStatusPill('anonymous')
              : authType === 'loading'
                ? renderStatusPill('checking')
                : renderStatusPill('authenticated')}
          </div>
          <div className="font-body mt-1 text-sm text-slate-600 dark:text-slate-300">
            {gatedPagesCount > 0 ? `${gatedPagesCount} gated pages in current window` : 'No gated pages'}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-[1.25rem] border border-slate-200/80 bg-white/75 p-4 dark:border-slate-800 dark:bg-slate-950/45">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-display flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em]">
            <span className="rounded-full border border-sky-200/80 bg-sky-50/90 px-3 py-1 text-sky-700 dark:border-sky-900 dark:bg-sky-950/35 dark:text-sky-200">
              Pages 1-3 public
            </span>
            <span className="rounded-full border border-amber-300/80 bg-amber-50/90 px-3 py-1 text-amber-800 dark:border-amber-700 dark:bg-amber-950/35 dark:text-amber-200">
              Page 4+ login required
            </span>
            <span className="rounded-full border border-violet-300/80 bg-violet-50/90 px-3 py-1 text-violet-800 dark:border-violet-700 dark:bg-violet-950/35 dark:text-violet-200">
              Page 31+ use API
            </span>
          </div>
          <div className="font-display text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Showing {visibleRecordCount} rows
          </div>
        </div>
        <div className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500 lg:hidden dark:text-slate-400">
          Swipe horizontally to view more columns
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#0ea5e9,#22c55e,#f59e0b)] transition-all duration-300"
            style={{ width: `${Math.min((page / UI_PAGE_LIMIT) * 100, 100)}%` }}
          />
        </div>
      </div>

      {hintMessage ? (
        <div className="mt-5 rounded-[1.35rem] border border-amber-300/70 bg-[linear-gradient(180deg,rgba(255,251,235,0.98),rgba(254,243,199,0.9))] px-4 py-4 text-sm text-amber-900 shadow-[0_16px_36px_rgba(245,158,11,0.16)] dark:border-amber-800 dark:bg-[linear-gradient(180deg,rgba(69,26,3,0.32),rgba(120,53,15,0.22))] dark:text-amber-100">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              <div className="font-body font-medium">{hintMessage}</div>
              <div className="font-display mt-1 text-xs uppercase tracking-[0.22em] text-amber-800/80 dark:text-amber-200/80">
                Access guidance
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href="/jumps#api-access"
                  className="font-display inline-flex items-center gap-2 rounded-full border border-amber-400/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-amber-900 dark:border-amber-700 dark:text-amber-100"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Open access center
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-5 rounded-[1.35rem] border border-red-300/70 bg-red-50/90 px-4 py-4 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200">
          {errorMessage}
        </div>
      ) : null}

      <div className="relative mt-6 overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-slate-800 dark:bg-slate-950/55">
        {isPageTransitioning ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-white/72 backdrop-blur-[2px] dark:bg-slate-950/72">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-sky-700 shadow-[0_16px_32px_rgba(14,165,233,0.14)] dark:border-sky-900/70 dark:bg-slate-950/90 dark:text-sky-200">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Loading page
            </div>
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="min-w-[720px] border-separate border-spacing-0 md:min-w-full">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50/95 dark:bg-slate-950/95">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className="font-display border-b border-slate-200/80 px-4 py-4 text-left text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:border-slate-800 dark:text-slate-400"
                  >
                    {column.mobileLabel ?? column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && !isPageTransitioning ? (
                <LoadingRows columnCount={columns.length} />
              ) : items.length > 0 ? (
                items.map((item, rowIndex) => {
                  const href = getItemHref?.(item) ?? null

                  return (
                    <tr
                      key={(item as { id?: string }).id ?? `${title}-${rowIndex}`}
                      className={`transition-colors duration-150 hover:bg-sky-50/70 dark:hover:bg-slate-900/80 ${href ? 'cursor-pointer' : ''}`}
                      onClick={() => {
                        if (!href) {
                          return
                        }

                        if (openItemInNewTab) {
                          window.open(href, '_blank', 'noopener,noreferrer')
                          return
                        }

                        router.push(href)
                      }}
                      onKeyDown={(event) => {
                        if (!href) {
                          return
                        }

                        if (event.key !== 'Enter' && event.key !== ' ') {
                          return
                        }

                        event.preventDefault()

                        if (openItemInNewTab) {
                          window.open(href, '_blank', 'noopener,noreferrer')
                          return
                        }

                        router.push(href)
                      }}
                      tabIndex={href ? 0 : undefined}
                      role={href ? 'link' : undefined}
                    >
                      {columns.map((column) => (
                        <td
                          key={column.key}
                          className="h-[72px] border-b border-slate-200/70 px-4 py-4 align-middle text-sm text-slate-700 dark:border-slate-800 dark:text-slate-200"
                        >
                          <div className="group flex items-center gap-2">
                            <span
                              className={`font-body block min-w-0 ${column.allowWrap
                                ? 'max-w-[14rem] truncate'
                                : 'max-w-[12rem] truncate whitespace-nowrap'
                                }`}
                            >
                              {column.render(item)}
                            </span>
                            {column.copyValue?.(item) ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  const value = column.copyValue?.(item)
                                  if (!value) return
                                  void navigator.clipboard.writeText(value)
                                  notification.success('Copied to clipboard')
                                }}
                                className="opacity-0 transition group-hover:opacity-100"
                                aria-label={`Copy ${column.label}`}
                              >
                                <Copy className="mt-0.5 h-3.5 w-3.5 text-slate-400 hover:text-sky-600 dark:text-slate-500 dark:hover:text-sky-300" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      ))}
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="font-body px-4 py-14 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    No records on this page.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="font-body text-sm text-slate-500 dark:text-slate-400">
          {pagination
            ? `${pagination.total.toLocaleString('en-US')} records indexed`
            : 'Fetching totals'}
        </div>

        <div className="rounded-full border border-slate-200/80 bg-white/80 p-1.5 shadow-[0_16px_36px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-950/60">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="soft"
              onClick={() => {
                startTransition(() => {
                  loadPage(Math.max(1, page - 1), {
                    preserveContent: items.length > 0,
                  }).catch((error) => {
                    setErrorMessage(error instanceof Error ? error.message : 'Failed to change page')
                    setIsLoading(false)
                    setIsPageTransitioning(false)
                  })
                })
              }}
              disabled={isLoading || page <= 1}
              className={getPaginationButtonClassName()}
            >
              Prev
            </Button>

            {pageWindow.map((pageNumber) => (
              <Button
                key={pageNumber}
                type="button"
                variant={pageNumber === page ? 'solid' : 'soft'}
                onClick={() => {
                  startTransition(() => {
                    loadPage(pageNumber, {
                      preserveContent: items.length > 0,
                    }).catch((error) => {
                      setErrorMessage(
                        error instanceof Error ? error.message : 'Failed to change page'
                      )
                      setIsLoading(false)
                      setIsPageTransitioning(false)
                    })
                  })
                }}
                disabled={isLoading}
                className={getPaginationButtonClassName(pageNumber === page)}
              >
                {pageNumber}
              </Button>
            ))}

            <Button
              type="button"
              variant="soft"
              onClick={() => {
                startTransition(() => {
                  loadPage(page + 1, {
                    preserveContent: items.length > 0,
                  }).catch((error) => {
                    setErrorMessage(error instanceof Error ? error.message : 'Failed to change page')
                    setIsLoading(false)
                    setIsPageTransitioning(false)
                  })
                })
              }}
              disabled={isLoading || page >= visibleTotalPages}
              className={getPaginationButtonClassName()}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </article>
  )
}

export default function OverviewIndexerTables() {
  const [authType, setAuthType] = useState<AuthType>('loading')

  const refreshAuthStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', {
        cache: 'no-store',
      })

      if (response.status === 401) {
        setAuthType('anonymous')
        return 'anonymous'
      }

      const payload = await parseJsonResponse<{
        auth?: {
          type?: Exclude<AuthType, 'loading'>
        }
      }>(response)
      const nextType = payload.auth?.type ?? 'anonymous'
      setAuthType(nextType)
      return nextType
    } catch {
      setAuthType('anonymous')
      return 'anonymous'
    }
  }, [])

  useEffect(() => {
    startTransition(() => {
      refreshAuthStatus().catch(() => {
        setAuthType('anonymous')
      })
    })
  }, [refreshAuthStatus])

  return (
    <section className="grid gap-8">
      <ListingCard<TransactionBlockItem>
        title="Transaction Blocks"
        eyebrow="Primary ledger stream"
        description="Recent blocks with digest, sender, kind, status, and time."
        endpoint="/api/indexer/transaction-blocks"
        authType={authType}
        refreshAuthStatus={refreshAuthStatus}
        getItemHref={(item) => `/indexer/transaction-blocks/${encodeURIComponent(item.digest)}`}
        columns={[
          {
            key: 'digest',
            label: 'Digest',
            render: (item) => (
              <span className="font-data">{truncateValue(item.digest, 10, 8)}</span>
            ),
            copyValue: (item) => item.digest,
          },
          {
            key: 'sender',
            label: 'Sender',
            render: (item) => (
              <span className="font-data">{truncateValue(item.senderAddress)}</span>
            ),
            copyValue: (item) => item.senderAddress,
          },
          {
            key: 'kind',
            label: 'Kind',
            render: (item) => item.transactionKind ?? 'Unknown',
          },
          {
            key: 'status',
            label: 'Status',
            render: (item) => renderStatusIcon(item.status),
          },
          {
            key: 'time',
            label: 'Time',
            render: (item) => <RelativeTime value={item.transactionTime} />,
          },
        ]}
      />

      <ListingCard<MoveCallItem>
        title="Move Call"
        eyebrow="Execution detail stream"
        description="Move execution targets, package references, sender, and time."
        endpoint="/api/indexer/move-calls"
        authType={authType}
        refreshAuthStatus={refreshAuthStatus}
        getItemHref={(item) =>
          `/indexer/move-calls/${encodeURIComponent(item.txDigest)}/${encodeURIComponent(String(item.callIndex ?? 0))}`
        }
        openItemInNewTab
        columns={[
          {
            key: 'txDigest',
            label: 'Tx Digest',
            render: (item) => (
              <span className="font-data">{truncateValue(item.txDigest, 10, 8)}</span>
            ),
            copyValue: (item) => item.txDigest,
          },
          {
            key: 'action',
            label: 'Action',
            mobileLabel: 'Action',
            allowWrap: true,
            render: (item) => (
              <ParsedActionSummary
                summary={item.actionSummary}
                entities={item.actionEntities}
                stopPropagation
              />
            ),
          },
          {
            key: 'rawCall',
            label: 'Raw Call',
            mobileLabel: 'Raw',
            allowWrap: true,
            render: (item) => <RawCallPreview item={item} />,
          },
          {
            key: 'target',
            label: 'Target',
            render: (item) => (
              <span className="font-data">
                {`${item.moduleName ?? 'unknown'}::${item.functionName ?? 'unknown'}`}
              </span>
            ),
            copyValue: (item) =>
              `${item.moduleName ?? 'unknown'}::${item.functionName ?? 'unknown'}`,
          },
          {
            key: 'package',
            label: 'Package',
            render: (item) => (
              <span className="font-data">{truncateValue(item.packageId)}</span>
            ),
            copyValue: (item) => item.packageId,
          },
          {
            key: 'sender',
            label: 'Sender',
            render: (item) => (
              <span className="font-data">{truncateValue(item.senderAddress)}</span>
            ),
            copyValue: (item) => item.senderAddress,
          },
          {
            key: 'time',
            label: 'Time',
            render: (item) => <RelativeTime value={item.transactionTime} />,
          },
        ]}
      />
    </section>
  )
}
