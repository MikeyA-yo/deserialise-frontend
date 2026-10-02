import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function base(props: IconProps) {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...props,
  }
}

export function IconGear(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.2v2.1M12 18.7v2.1M3.2 12h2.1M18.7 12h2.1M5.8 5.8l1.5 1.5M16.7 16.7l1.5 1.5M18.2 5.8l-1.5 1.5M7.3 16.7l-1.5 1.5" />
    </svg>
  )
}

export function IconClose(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

export function IconSearch(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16.5 20 20.5" />
    </svg>
  )
}

export function IconArrowDown(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M7 14l5 5 5-5" />
    </svg>
  )
}

export function IconChevron(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m8 10 4 4 4-4" />
    </svg>
  )
}

export function IconExternal(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M14 6h4v4M10 14 18 6M8 7H6.5A1.5 1.5 0 0 0 5 8.5v9A1.5 1.5 0 0 0 6.5 19h9a1.5 1.5 0 0 0 1.5-1.5V14" />
    </svg>
  )
}

export function IconCopy(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M6 16H5.5A1.5 1.5 0 0 1 4 14.5v-9A1.5 1.5 0 0 1 5.5 4h9A1.5 1.5 0 0 1 16 5.5V6" />
    </svg>
  )
}

export function IconWallet(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10h18M16 14.5h2" />
    </svg>
  )
}

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="10" fill="#e4ff57" />
      <circle cx="10" cy="16" r="2.2" fill="#14160a" />
      <circle cx="22" cy="10" r="2.2" fill="#14160a" />
      <circle cx="22" cy="22" r="2.2" fill="#14160a" />
      <path d="M12 15.2 19.7 11.4M12 16.8 19.7 20.6" stroke="#14160a" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

export function IconCoinbase({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#0052FF" />
      <circle cx="16" cy="16" r="8" fill="white" />
      <rect x="13.5" y="13.5" width="5" height="5" rx="1" fill="#0052FF" />
    </svg>
  )
}

export function IconWalletConnect({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#3B99FC" />
      <path
        d="M9.5 12.8C13.1 9.2 18.9 9.2 22.5 12.8L23.5 13.8C23.7 14 23.7 14.4 23.5 14.6L21.7 16.4C21.6 16.5 21.4 16.5 21.3 16.4L19.9 15C17.7 12.8 14.3 12.8 12.1 15L10.7 16.4C10.6 16.5 10.4 16.5 10.3 16.4L8.5 14.6C8.3 14.4 8.3 14 8.5 13.8L9.5 12.8ZM25.8 16.1L27.4 17.7C27.6 17.9 27.6 18.3 27.4 18.5L20.2 25.7C20 25.9 19.6 25.9 19.4 25.7L16 22.3C15.9 22.2 15.8 22.2 15.7 22.3L12.3 25.7C12.1 25.9 11.7 25.9 11.5 25.7L4.3 18.5C4.1 18.3 4.1 17.9 4.3 17.7L5.9 16.1C6.1 15.9 6.5 15.9 6.7 16.1L10.1 19.5C10.2 19.6 10.3 19.6 10.4 19.5L13.8 16.1C14 15.9 14.4 15.9 14.6 16.1L15.9 17.4C16 17.5 16.1 17.5 16.2 17.4L17.5 16.1C17.7 15.9 18.1 15.9 18.3 16.1L21.7 19.5C21.8 19.6 21.9 19.6 22 19.5L25.4 16.1C25.5 15.9 25.7 15.9 25.8 16.1Z"
        fill="white"
      />
    </svg>
  )
}

export function IconMetaMask({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#F6851B" />
      <path
        d="M24.8 7.5L17.2 13.1L18.6 9.8L24.8 7.5ZM7.2 7.5L14.7 13.2L13.4 9.8L7.2 7.5ZM22.4 21.4L19.5 25.8L24.4 24.3L25.6 18.6L22.4 21.4ZM9.6 21.4L6.4 18.6L7.6 24.3L12.5 25.8L9.6 21.4ZM14.1 16.6L12.8 18.7L18.2 18.8L17.7 16.6L16 15.5L14.1 16.6ZM13.8 22.8L15.9 22.1L18.1 22.8L16 26.2L13.8 22.8Z"
        fill="white"
      />
    </svg>
  )
}

export function IconRainbow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#1C1E24" />
      <path d="M8 22C8 17.58 11.58 14 16 14C20.42 14 24 17.58 24 22" stroke="#FF4040" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M10.8 22C10.8 19.13 13.13 16.8 16 16.8C18.87 16.8 21.2 19.13 21.2 22" stroke="#FFB800" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M13.6 22C13.6 20.67 14.67 19.6 16 19.6C17.33 19.6 18.4 20.67 18.4 22" stroke="#00E599" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

export function IconPhone(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="5" y="2" width="14" height="20" rx="2.5" />
      <path d="M12 18h.01" />
    </svg>
  )
}

