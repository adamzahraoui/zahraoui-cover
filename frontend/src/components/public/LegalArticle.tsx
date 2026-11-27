import type { ReactNode } from 'react'
import { PageHeading } from './PublicSections'

export function LegalArticle({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <PageHeading title={title} />
      <div className="site-container section-space">
        <article className="prose-copy panel mx-auto max-w-4xl p-5 sm:p-8">
          <p className="rounded bg-primary-tint p-3 text-sm text-primary">Version de travail à valider avant publication.</p>
          {children}
        </article>
      </div>
    </>
  )
}
