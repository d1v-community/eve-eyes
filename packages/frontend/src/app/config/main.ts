const rawAppName = process.env.NEXT_PUBLIC_APP_NAME?.trim()
const rawAppDescription = process.env.NEXT_PUBLIC_APP_DESCRIPTION?.trim()

export const APP_NAME =
  !rawAppName || rawAppName === 'Sui dApp Starter' || rawAppName === 'eve-eyes'
    ? 'EVE EYES'
    : rawAppName

export const APP_DESCRIPTION =
  !rawAppDescription ||
  rawAppDescription === 'Full-Stack Sui Starter on Steroids' ||
  rawAppDescription === 'eve-eyes'
    ? 'EVE EYES'
    : rawAppDescription
