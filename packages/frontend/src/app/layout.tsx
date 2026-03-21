import { type Metadata } from 'next'
import { IBM_Plex_Mono, Manrope, Space_Grotesk } from 'next/font/google'
import Header from '~~/components/layout/Header'
import Body from './components/layout/Body'
import Extra from './components/layout/Extra'
import Footer from './components/layout/Footer'
import { APP_DESCRIPTION, APP_NAME } from './config/main'
import ClientProviders from './providers/ClientProviders'
import './styles/index.css'

const fontDisplay = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
})

const fontBody = Manrope({
  subsets: ['latin'],
  variable: '--font-body',
})

const fontMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontDisplay.variable} ${fontBody.variable} ${fontMono.variable}`}
    >
      <body className="flex min-h-screen flex-col font-body" suppressHydrationWarning>
        <ClientProviders>
          <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6">
            <Header />
            <Body>{children}</Body>
            <Footer />
            <Extra />
          </div>
        </ClientProviders>
      </body>
    </html>
  )
}
