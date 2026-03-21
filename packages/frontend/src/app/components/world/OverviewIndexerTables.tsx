'use client'

import { Button } from '@radix-ui/themes'
import { AlertTriangle, Database, KeyRound, RefreshCw } from 'lucide-react'
import { startTransition, useCallback, useEffect, useState } from 'react'

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
  packageId: string | null
  moduleName: string | null
  functionName: string | null
  senderAddress: string | null
  status: string | null
  transactionTime: string | null
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
  className?: string
  render: (item: TItem) => string
}

type ListingCardProps<TItem> = {
  title: string
  description: string
  endpoint: string
  columns: Column<TItem>[]
  authType: AuthType
  refreshAuthStatus: () => Promise<AuthType>
}

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

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

function formatStatus(value: string | null) {
  if (!value) {
    return 'Unknown'
  }

  return value.replaceAll('_', ' ')
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

function ListingCard<TItem>({
  title,
  description,
  endpoint,
  columns,
  authType,
  refreshAuthStatus,
}: ListingCardProps<TItem>) {
  const [items, setItems] = useState<TItem[]>([])
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<PaginationPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [hintMessage, setHintMessage] = useState<string | null>(null)

  const loadPage = useCallback(
    async (targetPage: number) => {
      setErrorMessage(null)
      setHintMessage(null)

      if (targetPage > UI_PAGE_LIMIT) {
        setHintMessage('请使用 api 查询数据。')
        return
      }

      if (targetPage > FREE_PAGE_LIMIT) {
        const nextAuthType = await refreshAuthStatus()

        if (nextAuthType === 'anonymous') {
          setHintMessage('第 4 页起需要先登录才能查看。')
          return
        }
      }

      setIsLoading(true)

      try {
        const response = await fetch(`${endpoint}?page=${targetPage}&pageSize=${PAGE_SIZE}`, {
          cache: 'no-store',
        })

        if (response.status === 401) {
          await refreshAuthStatus()
          setHintMessage('第 4 页起需要先登录才能查看。')
          return
        }

        const payload = await parseJsonResponse<ListingResponse<TItem>>(response)
        setItems(payload.items ?? [])
        setPagination(payload.pagination ?? null)
        setPage(targetPage)

        if (targetPage === UI_PAGE_LIMIT && (payload.pagination?.totalPages ?? 0) > UI_PAGE_LIMIT) {
          setHintMessage('仅展示前 30 页，更多数据请使用 api 查询。')
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load data')
      } finally {
        setIsLoading(false)
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
  const requiresLogin = page >= FREE_PAGE_LIMIT && authType === 'anonymous'

  return (
    <article className="rounded-[1.8rem] border border-slate-200/70 bg-white/90 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-950/75">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
            Indexer Listing
          </div>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
            {title}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            {description}
          </p>
        </div>

        <Button
          type="button"
          variant="soft"
          onClick={() => {
            startTransition(() => {
              loadPage(page).catch((error) => {
                setErrorMessage(error instanceof Error ? error.message : 'Failed to refresh data')
                setIsLoading(false)
              })
            })
          }}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.24em]">
        <span className="rounded-full border border-slate-200/80 bg-slate-50/90 px-3 py-1 text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
          Page {page} / {visibleTotalPages}
        </span>
        <span className="rounded-full border border-sky-200/80 bg-sky-50/90 px-3 py-1 text-sky-700 dark:border-sky-900 dark:bg-sky-950/35 dark:text-sky-200">
          Pages 1-3 public
        </span>
        <span className="rounded-full border border-amber-300/80 bg-amber-50/90 px-3 py-1 text-amber-800 dark:border-amber-700 dark:bg-amber-950/35 dark:text-amber-200">
          Page 31+ use API
        </span>
      </div>

      {hintMessage ? (
        <div className="mt-4 rounded-[1.3rem] border border-amber-300/70 bg-amber-50/90 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div>{hintMessage}</div>
              {requiresLogin || page >= FREE_PAGE_LIMIT ? (
                <a
                  href="/jumps#api-access"
                  className="mt-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-amber-900 underline underline-offset-4 dark:text-amber-100"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Open access center
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-4 rounded-[1.3rem] border border-red-300/70 bg-red-50/90 px-4 py-3 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`border-b border-slate-200/80 px-3 py-3 text-left text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:border-slate-800 dark:text-slate-400 ${column.className ?? ''}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length > 0 ? (
              items.map((item, rowIndex) => (
                <tr key={(item as { id?: string }).id ?? `${title}-${rowIndex}`}>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`border-b border-slate-200/70 px-3 py-4 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-200 ${column.className ?? ''}`}
                    >
                      <span className="block whitespace-nowrap">{column.render(item)}</span>
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-12 text-center text-sm text-slate-500 dark:text-slate-400"
                >
                  {isLoading ? 'Loading data...' : 'No records on this page.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {pagination ? `${pagination.total.toLocaleString('en-US')} records indexed` : 'Fetching totals'}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="soft"
            onClick={() => {
              startTransition(() => {
                loadPage(Math.max(1, page - 1)).catch((error) => {
                  setErrorMessage(error instanceof Error ? error.message : 'Failed to change page')
                  setIsLoading(false)
                })
              })
            }}
            disabled={isLoading || page <= 1}
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
                  loadPage(pageNumber).catch((error) => {
                    setErrorMessage(
                      error instanceof Error ? error.message : 'Failed to change page'
                    )
                    setIsLoading(false)
                  })
                })
              }}
              disabled={isLoading}
            >
              {pageNumber}
            </Button>
          ))}

          <Button
            type="button"
            variant="soft"
            onClick={() => {
              startTransition(() => {
                loadPage(page + 1).catch((error) => {
                  setErrorMessage(error instanceof Error ? error.message : 'Failed to change page')
                  setIsLoading(false)
                })
              })
            }}
            disabled={isLoading || page >= visibleTotalPages}
          >
            Next
          </Button>
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
    <section className="grid gap-6">
      <div className="rounded-[2rem] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.9))] p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.88),rgba(15,23,42,0.78))]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
              Indexer Feed
            </div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
              Transaction Blocks and Move Call
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
              首页底部直接浏览链上索引数据。前 3 页公开，第 4 页起需要登录，第 31 页起请改用
              API 查询。
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/85 px-4 py-2 text-xs uppercase tracking-[0.24em] text-slate-600 dark:border-slate-700 dark:bg-slate-950/55 dark:text-slate-300">
            <Database className="h-3.5 w-3.5" />
            {authType === 'loading'
              ? 'Checking access'
              : authType === 'anonymous'
                ? 'Anonymous session'
                : 'Authenticated session'}
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <ListingCard<TransactionBlockItem>
            title="Transaction blocks"
            description="按页查看最近的 transaction block，包含 digest、sender、kind、status 和 transaction time。"
            endpoint="/api/indexer/transaction-blocks"
            authType={authType}
            refreshAuthStatus={refreshAuthStatus}
            columns={[
              {
                key: 'digest',
                label: 'Digest',
                render: (item) => truncateValue(item.digest, 10, 8),
              },
              {
                key: 'sender',
                label: 'Sender',
                render: (item) => truncateValue(item.senderAddress),
              },
              {
                key: 'kind',
                label: 'Kind',
                render: (item) => item.transactionKind ?? 'Unknown',
              },
              {
                key: 'status',
                label: 'Status',
                render: (item) => formatStatus(item.status),
              },
              {
                key: 'time',
                label: 'Time',
                render: (item) => formatDate(item.transactionTime),
              },
            ]}
          />

          <ListingCard<MoveCallItem>
            title="Move call"
            description="查看 move call 明细，包含 package、module、function、交易状态和时间。"
            endpoint="/api/indexer/move-calls"
            authType={authType}
            refreshAuthStatus={refreshAuthStatus}
            columns={[
              {
                key: 'txDigest',
                label: 'Tx Digest',
                render: (item) => truncateValue(item.txDigest, 10, 8),
              },
              {
                key: 'target',
                label: 'Target',
                render: (item) =>
                  `${item.moduleName ?? 'unknown'}::${item.functionName ?? 'unknown'}`,
              },
              {
                key: 'package',
                label: 'Package',
                render: (item) => truncateValue(item.packageId),
              },
              {
                key: 'sender',
                label: 'Sender',
                render: (item) => truncateValue(item.senderAddress),
              },
              {
                key: 'time',
                label: 'Time',
                render: (item) => formatDate(item.transactionTime),
              },
            ]}
          />
        </div>
      </div>
    </section>
  )
}
