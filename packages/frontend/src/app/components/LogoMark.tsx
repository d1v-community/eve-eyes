'use client'

import { useId } from 'react'
import { useTheme } from '../providers/ThemeProvider'

type LogoMarkProps = {
  className?: string
  title?: string
}

const LogoMark = ({ className, title = 'EVE Eyes logo' }: LogoMarkProps) => {
  const { resolvedTheme } = useTheme()
  const id = useId()
  const isDark = resolvedTheme === 'dark'

  const bgGradientId = `${id}-bg`
  const frameGradientId = `${id}-frame`
  const eyeStrokeGradientId = `${id}-eye-stroke`
  const irisGradientId = `${id}-iris`
  const glowFilterId = `${id}-glow`
  const panelClipId = `${id}-panel-clip`

  return (
    <svg
      viewBox="0 0 390 390"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={className}
    >
      <defs>
        <linearGradient
          id={bgGradientId}
          x1="48"
          y1="42"
          x2="340"
          y2="348"
          gradientUnits="userSpaceOnUse"
        >
          {isDark ? (
            <>
              <stop stopColor="#020B1A" />
              <stop offset="1" stopColor="#071A33" />
            </>
          ) : (
            <>
              <stop stopColor="#F8FDFF" />
              <stop offset="1" stopColor="#DBF4FF" />
            </>
          )}
        </linearGradient>
        <linearGradient
          id={frameGradientId}
          x1="61"
          y1="53"
          x2="331"
          y2="337"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={isDark ? '#5EE7FF' : '#0EA5E9'} />
          <stop offset="0.5" stopColor="#38BDF8" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient
          id={eyeStrokeGradientId}
          x1="84"
          y1="130"
          x2="304"
          y2="265"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={isDark ? '#9FF4FF' : '#38BDF8'} />
          <stop offset="0.45" stopColor="#49D8FF" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
        <radialGradient
          id={irisGradientId}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(195 195) rotate(90) scale(74)"
        >
          <stop stopColor={isDark ? '#C7FAFF' : '#ECFEFF'} />
          <stop offset="0.34" stopColor="#67E8F9" />
          <stop offset="0.68" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#1D4ED8" />
        </radialGradient>
        <filter
          id={glowFilterId}
          x="61"
          y="111"
          width="268"
          height="168"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="7" result="effect1_foregroundBlur" />
        </filter>
        <clipPath id={panelClipId}>
          <rect x="48" y="48" width="294" height="294" rx="78" />
        </clipPath>
      </defs>
      <rect x="48" y="48" width="294" height="294" rx="78" fill={`url(#${bgGradientId})`} />
      <rect
        x="57"
        y="57"
        width="276"
        height="276"
        rx="69"
        stroke={`url(#${frameGradientId})`}
        strokeWidth="10"
      />
      <g clipPath={`url(#${panelClipId})`} opacity={isDark ? 0.6 : 0.45}>
        <path
          d="M86 92H158"
          stroke={isDark ? '#10345D' : '#BAE6FD'}
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M240 92H302"
          stroke={isDark ? '#10345D' : '#BAE6FD'}
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M88 302H150"
          stroke={isDark ? '#10345D' : '#BAE6FD'}
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M234 302H304"
          stroke={isDark ? '#10345D' : '#BAE6FD'}
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M100 72V128"
          stroke={isDark ? '#123A67' : '#7DD3FC'}
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M290 72V118"
          stroke={isDark ? '#123A67' : '#7DD3FC'}
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M94 264V320"
          stroke={isDark ? '#123A67' : '#7DD3FC'}
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M286 258V318"
          stroke={isDark ? '#123A67' : '#7DD3FC'}
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M100 112H132V144"
          stroke={isDark ? '#1A4B7D' : '#38BDF8'}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M290 112H260V142"
          stroke={isDark ? '#1A4B7D' : '#38BDF8'}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M100 278H132V246"
          stroke={isDark ? '#1A4B7D' : '#38BDF8'}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M290 278H258V248"
          stroke={isDark ? '#1A4B7D' : '#38BDF8'}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g filter={`url(#${glowFilterId})`} opacity={isDark ? 0.6 : 0.45}>
        <path
          d="M85 195C110 145 148 120 195 120C242 120 280 145 305 195C280 245 242 270 195 270C148 270 110 245 85 195Z"
          stroke={isDark ? '#60EFFF' : '#38BDF8'}
          strokeWidth="14"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M85 195C110 145 148 120 195 120C242 120 280 145 305 195C280 245 242 270 195 270C148 270 110 245 85 195Z"
        fill={isDark ? '#081A31' : '#E0F2FE'}
        stroke={`url(#${eyeStrokeGradientId})`}
        strokeWidth="12"
        strokeLinejoin="round"
      />
      <path
        d="M103 195C126 155 156 136 195 136C234 136 264 155 287 195"
        stroke={isDark ? '#9FF4FF' : '#0EA5E9'}
        strokeWidth="8"
        strokeLinecap="round"
        opacity="0.95"
      />
      <path
        d="M114 229C137 248 164 257 195 257C226 257 253 248 276 229"
        stroke="#1D4ED8"
        strokeWidth="7"
        strokeLinecap="round"
        opacity="0.85"
      />
      <circle cx="195" cy="195" r="71" fill={`url(#${irisGradientId})`} />
      <circle cx="195" cy="195" r="46" fill={isDark ? '#07111F' : '#082F49'} />
      <circle cx="195" cy="195" r="24" fill={isDark ? '#01060E' : '#020617'} />
      <circle cx="223" cy="165" r="10" fill="white" fillOpacity="0.98" />
      <circle cx="163" cy="224" r="7" fill="#A5F3FC" fillOpacity="0.5" />
      <path
        d="M162 195H228"
        stroke="#A5F3FC"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M195 162V228"
        stroke="#38BDF8"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.35"
      />
      <path d="M121 169L138 177" stroke="#67E8F9" strokeWidth="6" strokeLinecap="round" />
      <path d="M269 214L286 222" stroke="#67E8F9" strokeWidth="6" strokeLinecap="round" />
    </svg>
  )
}

export default LogoMark
