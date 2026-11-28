import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useCompany } from '../config/CompanyProvider'

export function PageMain({ children, className }: { children: ReactNode; className: string }) {
  const company = useCompany()
  const main = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  const previousPath = useRef(pathname)

  useEffect(() => {
    const element = main.current
    if (!element) return
    let shouldFocus = previousPath.current !== pathname
    previousPath.current = pathname
    const updateHeading = () => {
      const heading = element.querySelector('h1')?.innerText.trim()
      if (!heading) return
      document.title = `${heading} | ${company.name}`
      if (shouldFocus) {
        shouldFocus = false
        window.scrollTo(0, 0)
        element.focus({ preventScroll: true })
      }
    }
    updateHeading()
    const headingObserver = new MutationObserver(updateHeading)
    headingObserver.observe(element, { childList: true, subtree: true, characterData: true })
    return () => headingObserver.disconnect()
  }, [pathname, company.name])

  return <main ref={main} id="contenu" tabIndex={-1} className={className}>{children}</main>
}
