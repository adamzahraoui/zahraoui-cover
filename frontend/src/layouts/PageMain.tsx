import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useCompany } from '../config/CompanyProvider'

export function PageMain({ children, className }: { children: ReactNode; className: string }) {
  const company = useCompany()
  const main = useRef<HTMLElement>(null)
  const { pathname } = useLocation()

  useEffect(() => {
    const element = main.current
    if (!element) return
    const updateTitle = () => {
      const heading = element.querySelector('h1')?.innerText.trim()
      if (heading) document.title = `${heading} | ${company.name}`
    }
    updateTitle()
    const headingObserver = new MutationObserver(updateTitle)
    headingObserver.observe(element, { childList: true, subtree: true, characterData: true })
    if (element.querySelector('h1')) {
      window.scrollTo(0, 0)
      element.focus({ preventScroll: true })
    }
    return () => headingObserver.disconnect()
  }, [pathname, company.name])

  return <main ref={main} id="contenu" tabIndex={-1} className={className}>{children}</main>
}
