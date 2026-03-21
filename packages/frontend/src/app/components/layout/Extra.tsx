'use client'

import { Toaster } from 'react-hot-toast'
import AnimatedBackground from '../AnimatedBackground'
import { useTheme } from '../../providers/ThemeProvider'

const Extra = () => {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <>
      <AnimatedBackground />
      <Toaster
        position="top-right"
        gutter={14}
        containerClassName="!top-4 !right-3 !left-3 md:!top-6 md:!right-6 md:!left-auto"
        toastOptions={{
          className: 'w-full !bg-transparent !shadow-none md:!max-w-[26rem]',
          style: {
            maxWidth: 'none',
            background: 'transparent',
            color: isDark ? 'rgba(241, 245, 249, 0.98)' : 'rgba(1, 22, 49, 0.96)',
            boxShadow: 'none',
            padding: 0,
          },
        }}
      />
    </>
  )
}
export default Extra
