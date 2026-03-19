import GreetingForm from '~~/dapp/components/GreetingForm'
import NetworkSupportChecker from './components/NetworkSupportChecker'
import EnvConfigWarning from './components/EnvConfigWarning'

export default function Home() {
  return (
    <>
      <EnvConfigWarning />
      <NetworkSupportChecker />
      <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center px-4 py-8">
        <section className="mb-10 w-full max-w-2xl text-center">
          <h1 className="bg-gradient-to-r from-sds-blue to-sds-pink bg-clip-text text-4xl font-bold text-transparent sm:text-5xl">
            Hello World on Sui
          </h1>
          <p className="mt-4 text-sm text-slate-300 sm:text-base">
            Connect your wallet, deploy a simple greeting on Sui, and
            update it with your name. This MVP page wraps the original
            greeting flow in a clearer layout so you can focus on trying
            the on-chain experience.
          </p>
        </section>

        <section className="w-full max-w-xl">
          <GreetingForm />
        </section>
      </main>
    </>
  )
}
