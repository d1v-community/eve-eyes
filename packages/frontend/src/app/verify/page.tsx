import { ShieldCheck } from 'lucide-react'
import OperationsShell from '../components/world/OperationsShell'
import VerifyPodActions from '../components/world/VerifyPodActions'
import VerifyCardShell from '../components/world/VerifyCardShell'
import VerifySearchForm from '../components/world/VerifySearchForm'
import {
  getSolarSystem,
  getSolarSystemPod,
  verifyPod,
} from '../world/api'

type PageProps = {
  searchParams: Promise<{
    systemId?: string
  }>
}

export default async function VerifyPage({ searchParams }: PageProps) {
  const params = await searchParams
  const systemId = Number(params.systemId)
  const validSystemId = Number.isFinite(systemId) ? systemId : 30000004

  const [systemResult, podResult] = await Promise.all([
    getSolarSystem(validSystemId),
    getSolarSystemPod(validSystemId),
  ])

  const verificationResult =
    podResult.data != null ? await verifyPod(podResult.data) : null

  const shareUrl = `/verify?systemId=${validSystemId}`
  const copyText = JSON.stringify(
    {
      system: systemResult.data?.name ?? 'Unknown',
      systemId: validSystemId,
      signerPublicKey: podResult.data?.signerPublicKey ?? null,
      signature: podResult.data?.signature ?? null,
      isValid: verificationResult?.data?.isValid ?? false,
    },
    null,
    2
  )

  return (
    <OperationsShell>
      <div className="flex flex-col gap-6">
        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/75">
          <div className="mb-6 space-y-3">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-1 text-xs uppercase tracking-[0.28em] text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              POD verify
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">
              Generate a verified system card and make it shareable.
            </h1>
            <p className="max-w-xl text-sm leading-7 text-slate-600 dark:text-slate-300">
              Search a solar system, fetch its POD representation, verify the
              signature, and package the result into a card that can be copied
              or shared.
            </p>
          </div>

          <VerifySearchForm />

          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
            This page keeps the data verifiable. The JSON source is not hidden;
            it is wrapped in a human-readable card with copy/share actions.
          </div>
        </div>

        <section className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/75">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                Shareable card
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                {systemResult.data?.name ?? `System ${validSystemId}`}
              </h2>
            </div>
            <VerifyPodActions sharePath={shareUrl} copyText={copyText} />
          </div>

          <div className="grid gap-4">
            <VerifyCardShell
              title={systemResult.data?.name ?? `System ${validSystemId}`}
              subtitle={`#${validSystemId} · POD-backed World API record`}
              status={verificationResult?.data?.isValid ? 'Valid' : 'Unavailable'}
              signer={podResult.data?.signerPublicKey ?? podResult.error ?? 'Unavailable'}
              signature={podResult.data?.signature ?? 'Unavailable'}
              payload={JSON.stringify(podResult.data?.entries ?? {}, null, 2)}
              facts={
                systemResult.data ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                      <div className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                        Identity
                      </div>
                      <div className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                        #{systemResult.data.id} · constellation{' '}
                        {systemResult.data.constellationId} · region{' '}
                        {systemResult.data.regionId}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                      <div className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                        Gate links
                      </div>
                      <div className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                        {systemResult.data.gateLinks.length} outbound connections
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300">
                    {systemResult.error ?? 'System details unavailable'}
                  </div>
                )
              }
            />

            <article className="rounded-3xl border border-slate-200/70 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="mb-3 text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                System facts
              </div>
              {systemResult.data ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                      Identity
                    </div>
                    <div className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                      #{systemResult.data.id} · constellation{' '}
                      {systemResult.data.constellationId} · region{' '}
                      {systemResult.data.regionId}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                      Gate links
                    </div>
                    <div className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                      {systemResult.data.gateLinks.length} outbound connections
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300">
                  {systemResult.error ?? 'System details unavailable'}
                </div>
              )}
            </article>

            <article className="rounded-3xl border border-slate-200/70 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="mb-3 text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                POD payload preview
              </div>
              <pre className="overflow-auto rounded-2xl border border-slate-200/70 bg-slate-950 p-4 text-xs leading-6 text-slate-200 dark:border-slate-800">
                {JSON.stringify(podResult.data?.entries ?? {}, null, 2)}
              </pre>
            </article>
          </div>
        </section>
        </section>
      </div>
    </OperationsShell>
  )
}
