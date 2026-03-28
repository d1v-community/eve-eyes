'use client'

import { useMemo, useState } from 'react'
import { Braces, Link2, LoaderCircle, Play } from 'lucide-react'
import {
  API_DOCS,
  API_GROUPS,
  type ApiDoc,
  getAuthLabel,
} from './api-docs-catalog'
import { notification } from '../../helpers/notification'

function getMethodClassName(method: ApiDoc['method']) {
  if (method === 'GET') {
    return 'border-sky-300/80 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/35 dark:text-sky-100'
  }

  if (method === 'POST') {
    return 'border-emerald-300/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-100'
  }

  return 'border-rose-300/80 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-100'
}

function getGroupButtonClassName(active: boolean) {
  return active
    ? 'border-sky-300/80 bg-[linear-gradient(135deg,rgba(224,242,254,0.98),rgba(186,230,253,0.92))] text-slate-950 shadow-[0_18px_38px_rgba(14,165,233,0.16)] ring-1 ring-white/80 dark:border-sky-700/80 dark:bg-[linear-gradient(135deg,rgba(8,47,73,0.88),rgba(15,23,42,0.96))] dark:text-white dark:shadow-[0_20px_40px_rgba(14,165,233,0.14)] dark:ring-sky-400/10'
    : 'border-transparent bg-white/65 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] hover:border-slate-200/80 hover:bg-white/95 hover:text-slate-950 dark:bg-slate-950/25 dark:text-slate-200 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] dark:hover:border-slate-700/80 dark:hover:bg-slate-950/60 dark:hover:text-white'
}

function getDocButtonClassName(active: boolean) {
  return active
    ? 'border-sky-400/90 bg-[linear-gradient(135deg,rgba(2,132,199,0.96),rgba(14,165,233,0.92))] text-white shadow-[0_16px_34px_rgba(14,165,233,0.22)] ring-1 ring-sky-200/60 dark:border-sky-300/80 dark:bg-[linear-gradient(135deg,rgba(8,47,73,0.98),rgba(14,116,144,0.9))] dark:text-sky-50 dark:shadow-[0_18px_38px_rgba(14,165,233,0.16)] dark:ring-sky-300/10'
    : 'border-slate-200/80 bg-white/90 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 dark:border-slate-800/90 dark:bg-slate-950/55 dark:text-slate-200 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] dark:hover:border-slate-700 dark:hover:bg-slate-950/90 dark:hover:text-white'
}

export default function ApiDocsExplorer() {
  const [activeGroup, setActiveGroup] = useState<ApiDoc['group']>('indexer')
  const initialDoc = useMemo(
    () => API_DOCS.find((doc) => doc.group === 'indexer')?.id ?? API_DOCS[0].id,
    []
  )
  const [activeDocId, setActiveDocId] = useState(initialDoc)
  const [testingDocId, setTestingDocId] = useState<string | null>(null)

  const groupDocs = API_DOCS.filter((doc) => doc.group === activeGroup)
  const activeDoc =
    groupDocs.find((doc) => doc.id === activeDocId) ??
    groupDocs[0] ??
    API_DOCS[0]

  async function handleTestApi(doc: ApiDoc) {
    if (!doc.testRequest) {
      notification.error(
        null,
        'This endpoint needs custom input or changes data, so automatic testing is disabled.'
      )
      return
    }

    setTestingDocId(doc.id)
    const toastId = notification.loading(`Testing ${doc.method} ${doc.path}...`)

    try {
      const response = await fetch(doc.testRequest.path, {
        method: doc.testRequest.method ?? doc.method,
        headers: doc.testRequest.headers,
        body: doc.testRequest.body,
        credentials: 'include',
      })

      if (response.status === 200) {
        notification.success(`API returned 200 for ${doc.path}`, toastId)
        return
      }

      const payload = await response.json().catch(() => null)
      const errorMessage =
        typeof payload?.error === 'string'
          ? payload.error
          : `Request failed with status ${response.status}`
      notification.error(null, errorMessage, toastId)
    } catch (error) {
      notification.error(
        error instanceof Error ? error : null,
        error instanceof Error ? error.message : 'Failed to test API',
        toastId
      )
    } finally {
      setTestingDocId(null)
    }
  }

  return (
    <article className="bg-white/92 rounded-[2rem] border border-slate-200/70 p-6 shadow-[0_28px_80px_rgba(15,23,42,0.08)] dark:border-slate-800/90 dark:bg-[linear-gradient(180deg,rgba(3,8,18,0.98),rgba(8,16,30,0.95))]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
            <Braces className="h-4 w-4" />
            API Explorer
          </div>
          <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
            All API endpoints in one place
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
            Browse the project’s current API surface by group, then switch
            between child tabs to inspect each endpoint’s path, auth mode,
            filters, and copy-ready examples.
          </p>
        </div>
        <div className="rounded-full border border-slate-200/80 bg-slate-50/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
          {API_DOCS.length} endpoints
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-[1.6rem] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.97),rgba(241,245,249,0.92))] p-3 shadow-[0_16px_34px_rgba(15,23,42,0.05)] dark:border-slate-800/90 dark:bg-[linear-gradient(180deg,rgba(3,8,18,0.97),rgba(8,16,30,0.94))]">
          <div className="space-y-2">
            {API_GROUPS.map((group) => {
              const Icon = group.icon
              const isActive = activeGroup === group.id

              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => {
                    setActiveGroup(group.id)
                    const nextDoc = API_DOCS.find(
                      (doc) => doc.group === group.id
                    )
                    if (nextDoc) {
                      setActiveDocId(nextDoc.id)
                    }
                  }}
                  className={`group w-full rounded-[1.25rem] border px-4 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-sky-300/70 dark:focus-visible:ring-offset-slate-950 ${getGroupButtonClassName(isActive)}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                      <Icon
                        className={`h-4 w-4 shrink-0 ${isActive ? 'text-sky-700 dark:text-sky-200' : 'text-slate-500 dark:text-slate-400'}`}
                      />
                      <span className="truncate">{group.label}</span>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${
                        isActive
                          ? 'bg-white/80 text-sky-900 dark:bg-white/10 dark:text-sky-100'
                          : 'bg-slate-100/90 text-slate-500 dark:bg-slate-900/80 dark:text-slate-400'
                      }`}
                    >
                      {API_DOCS.filter((doc) => doc.group === group.id).length}
                    </span>
                  </div>
                  <div
                    className={`mt-1 text-xs leading-5 ${isActive ? 'text-slate-700 dark:text-sky-100/90' : 'text-slate-600 dark:text-slate-300'}`}
                  >
                    {group.description}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-4 rounded-[1.3rem] border border-slate-200/70 bg-white/80 p-3 dark:border-slate-800/90 dark:bg-slate-950/40">
            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              {API_GROUPS.find((group) => group.id === activeGroup)?.label}{' '}
              endpoints
            </div>
            <div className="mt-3 space-y-2">
              {groupDocs.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setActiveDocId(doc.id)}
                  className={`group w-full rounded-[1.05rem] border px-3 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-sky-300/70 dark:focus-visible:ring-offset-slate-950 ${getDocButtonClassName(activeDoc?.id === doc.id)}`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${getMethodClassName(doc.method)}`}
                    >
                      {doc.method}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {doc.title}
                    </span>
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full transition ${
                        activeDoc?.id === doc.id
                          ? 'bg-white shadow-[0_0_0_4px_rgba(255,255,255,0.18)] dark:bg-sky-200 dark:shadow-[0_0_0_4px_rgba(125,211,252,0.12)]'
                          : 'bg-slate-300 group-hover:bg-slate-400 dark:bg-slate-700 dark:group-hover:bg-slate-500'
                      }`}
                    />
                  </div>
                  <div
                    className={`mt-1 truncate font-mono text-[11px] ${activeDoc?.id === doc.id ? 'text-white/80 dark:text-sky-100/80' : 'text-slate-500 dark:text-slate-400'}`}
                  >
                    {doc.path}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="rounded-[1.75rem] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] p-5 shadow-[0_18px_44px_rgba(15,23,42,0.06)] dark:border-slate-800/90 dark:bg-[linear-gradient(180deg,rgba(6,12,22,0.97),rgba(10,18,34,0.94))]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${getMethodClassName(activeDoc.method)}`}
                >
                  {activeDoc.method}
                </span>
                <span className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200">
                  {getAuthLabel(activeDoc.auth)}
                </span>
              </div>
              <h4 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
                {activeDoc.title}
              </h4>
              <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                {activeDoc.summary}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void handleTestApi(activeDoc)
                }}
                disabled={testingDocId === activeDoc.id}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/85 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-100"
              >
                {testingDocId === activeDoc.id ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                {testingDocId === activeDoc.id ? 'Testing' : 'Test API'}
              </button>
              <a
                href={`#${activeDoc.id}`}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 transition hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
              >
                <Link2 className="h-3.5 w-3.5" />
                Deep Link
              </a>
            </div>
          </div>

          <div id={activeDoc.id} className="mt-5 space-y-5">
            <div className="rounded-[1.4rem] border border-slate-200/80 bg-white/85 p-4 dark:border-slate-800 dark:bg-slate-950/55">
              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                Endpoint
              </div>
              <div className="mt-2 break-all rounded-[1rem] border border-slate-200/80 bg-slate-950 px-4 py-3 font-mono text-sm text-slate-100 dark:border-slate-800">
                {activeDoc.path}
              </div>
            </div>

            {activeDoc.params && activeDoc.params.length > 0 ? (
              <div className="rounded-[1.4rem] border border-slate-200/80 bg-white/85 p-4 dark:border-slate-800 dark:bg-slate-950/55">
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  Parameters
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeDoc.params.map((param) => (
                    <span
                      key={param}
                      className="rounded-full border border-slate-200/80 bg-slate-50/90 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-700 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-200"
                    >
                      {param}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-[1.4rem] border border-slate-200/80 bg-white/85 p-4 dark:border-slate-800 dark:bg-slate-950/55">
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  Response shape
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeDoc.response.map((field) => (
                    <span
                      key={field}
                      className="rounded-full border border-sky-200/80 bg-sky-50/90 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-sky-800 dark:border-sky-900 dark:bg-sky-950/35 dark:text-sky-200"
                    >
                      {field}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.4rem] border border-slate-200/80 bg-white/85 p-4 dark:border-slate-800 dark:bg-slate-950/55">
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  Notes
                </div>
                <div className="mt-3 space-y-2">
                  {activeDoc.notes.map((note) => (
                    <div
                      key={note}
                      className="rounded-[1rem] border border-slate-200/80 bg-slate-50/90 px-3 py-2 text-sm leading-6 text-slate-700 dark:border-slate-800 dark:bg-slate-950/55 dark:text-slate-200"
                    >
                      {note}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[1.4rem] border border-slate-200/80 bg-white/85 p-4 dark:border-slate-800 dark:bg-slate-950/55">
              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                Example
              </div>
              <pre className="mt-3 overflow-x-auto rounded-[1.2rem] border border-slate-200/80 bg-slate-950 px-4 py-3 text-xs leading-6 text-slate-100 dark:border-slate-800">
                {activeDoc.example}
              </pre>
            </div>
          </div>
        </section>
      </div>
    </article>
  )
}
