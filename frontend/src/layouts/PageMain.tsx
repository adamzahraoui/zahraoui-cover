import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { company } from '../config/company'

export function PageMain({ children, className }: { children: ReactNode; className: string }) {
  const main = useRef<HTMLElement>(null)
  const { pathname } = useLocation()

  useEffect(() => {
    // The heading can appear after a lazy route or its session guard has finished.
    const element = main.current
    const heading = element?.querySelector('h1')?.innerText.trim()
    if (!heading) return
    document.title = `${heading} | ${company.name}`
    window.scrollTo(0, 0)
    element?.focus({ preventScroll: true })
  }, [pathname])

  return <main ref={main} id="contenu" tabIndex={-1} className={className}>{children}</main>
}
