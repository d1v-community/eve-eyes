'use client'

import { supportedNetworks } from '../helpers/network'
import { ENetwork } from '../types/ENetwork'

const CONTRACT_ENV_VAR_BY_NETWORK: Record<ENetwork, string> = {
  [ENetwork.LOCALNET]: 'NEXT_PUBLIC_LOCALNET_CONTRACT_PACKAGE_ID',
  [ENetwork.DEVNET]: 'NEXT_PUBLIC_DEVNET_CONTRACT_PACKAGE_ID',
  [ENetwork.TESTNET]: 'NEXT_PUBLIC_TESTNET_CONTRACT_PACKAGE_ID',
  [ENetwork.MAINNET]: 'NEXT_PUBLIC_MAINNET_CONTRACT_PACKAGE_ID',
}

const EnvConfigWarning = () => {
  const okNetworks = supportedNetworks()

  // If at least one network has a valid contract package id configured,
  // we consider the environment good enough and show nothing.
  if (okNetworks.length > 0) {
    return null
  }

  const envVars = Object.values(CONTRACT_ENV_VAR_BY_NETWORK)

  return (
    <div className="mx-auto w-full max-w-lg px-3 py-2">
      <div className="w-full rounded border border-yellow-400 px-3 py-2 text-center text-sm text-yellow-200">
        <div className="font-semibold">No Sui contract networks are configured.</div>
        <div className="mt-1">
          Please configure at least one of the following environment
          variables for your deployment:
        </div>
        <div className="mt-1 font-mono text-xs">
          {envVars.join(', ')}
        </div>
        <div className="mt-1">
          On local development this is usually written into
          <span className="font-mono"> packages/frontend/.env.local</span>{' '}
          by the deployment scripts. On Vercel or other cloud providers,
          you need to set the same variable names in the project&apos;s
          environment settings.
        </div>
      </div>
    </div>
  )
}

export default EnvConfigWarning
