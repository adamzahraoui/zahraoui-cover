import { useState } from 'react'
import { CatalogCards, usePublicCatalog } from '../../../components/public/PublicCatalog'
import { ActionBand } from '../../../components/public/PublicSections'
import { Breadcrumb } from '../../../components/ui/Breadcrumb'
import type { Profile } from '../../../types/api'

const filters = [
  { value: 'ALL', label: 'Toutes' },
  { value: 'INDIVIDUAL', label: 'Particuliers' },
  { value: 'BUSINESS', label: 'Professionnels' },
] as const

export default function InsuranceCatalog() {
  const [audience, setAudience] = useState<Profile | 'ALL'>('ALL')
  const products = (usePublicCatalog().data ?? []).filter(product => audience === 'ALL' || product.audiences.includes(audience))
  return (
    <>
      <section className="border-b border-line bg-white">
        <div className="site-container grid gap-4 py-6 lg:py-12">
          <div className="hidden lg:block"><Breadcrumb items={[{ label: 'Accueil', to: '/' }, { label: 'Nos assurances' }]} /></div>
          <div className="grid items-end gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-8">
            <div className="grid gap-3">
              <h1 className="display-title"><span className="lg:hidden">Nos assurances</span><span className="hidden lg:inline">Nos solutions d’assurance</span></h1>
              <p className="max-w-2xl text-sm leading-6 text-muted lg:text-lg lg:leading-7">Découvrez les catégories d’assurance pour les particuliers et les professionnels. Les garanties dépendent du contrat retenu.</p>
            </div>
            <div className="grid grid-cols-3 rounded-md border border-line bg-background p-1 lg:flex" role="group" aria-label="Filtrer par profil">
              {filters.map(({ value, label }) => (
                <button key={value} type="button" aria-label={label} aria-pressed={audience === value} className="rounded px-1 py-2.5 text-sm font-semibold text-muted hover:bg-primary-tint aria-pressed:bg-primary aria-pressed:text-white lg:px-4" onClick={() => setAudience(value)}>
                  {value === 'BUSINESS' ? <><span className="lg:hidden">Pro</span><span className="hidden lg:inline">Professionnels</span></> : label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="site-container py-6 lg:py-12">
        <p className="sr-only" role="status">{products.length} catégories affichées.</p>
        <CatalogCards products={products} illustrated className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" />
      </section>
      <ActionBand assistance title="Besoin d’une assistance ou d’un conseil ?">Retrouvez le service d’assistance et les coordonnées de l’agence.</ActionBand>
    </>
  )
}
