import { ListTodo } from 'lucide-react'
import OperationsShell from '../components/world/OperationsShell'
import { apiCoverageTodo, productRoadmap } from '../world/roadmap'

export default function TodoPage() {
  return (
    <OperationsShell>
      <div className="flex flex-col gap-6">
        <section className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/75">
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/80 px-3 py-1 text-xs uppercase tracking-[0.28em] text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-200">
          <ListTodo className="h-3.5 w-3.5" />
          TODO
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">
          Delivery checklist for the World API product surface.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
          This page exists to keep product scope explicit as the interface
          expands from overview into task-focused pages.
        </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {productRoadmap.map((item) => (
            <article
              key={item.title}
              className="rounded-[1.75rem] border border-slate-200/70 bg-white/85 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/75"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
                  {item.title}
                </h2>
                <div className="rounded-full border border-slate-200/80 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-500 dark:border-slate-700 dark:text-slate-300">
                  {item.status}
                </div>
              </div>
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                {item.description}
              </p>
            </article>
          ))}
        </section>

        <section className="grid gap-3">
          {apiCoverageTodo.map((item) => (
            <article
              key={item}
              className="rounded-[1.5rem] border border-slate-200/70 bg-slate-50/80 px-4 py-4 text-sm leading-7 text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200"
            >
              {item}
            </article>
          ))}
        </section>
      </div>
    </OperationsShell>
  )
}
