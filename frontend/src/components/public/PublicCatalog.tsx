import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useApiData } from '../../hooks/useApiData'
import { api } from '../../services/api'
import type { ProductCard } from '../../types/api'
import { Button } from '../ui/Button'
import { EmptyState, ErrorState, LoadingState } from '../ui/States'
import { InsuranceCard } from './InsuranceCard'

const Catalog = createContext<ReturnType<typeof useApiData<ProductCard[]>> | null>(null)

export function PublicCatalogProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const catalog = useApiData(loadCatalog, pathname)
  return <Catalog.Provider value={catalog}>{children}</Catalog.Provider>
}

function loadCatalog(signal: AbortSignal) {
  return api.catalog(undefined, signal)
}

export function usePublicCatalog() {
  const context = useContext(Catalog)
  if (!context) throw new Error('Catalogue indisponible.')
  return context
}

export function CatalogCards({ products, illustrated, className }: { products: ProductCard[]; illustrated?: boolean; className: string }) {
  const catalog = usePublicCatalog()
  if (catalog.loading && !catalog.data) return <LoadingState />
  if (catalog.error) return <ErrorState>Le catalogue est temporairement indisponible. <Button variant="secondary" className="mt-2" onClick={catalog.reload}>Réessayer</Button></ErrorState>
  if (!products.length) return <EmptyState>Aucune catégorie disponible pour le moment.</EmptyState>
  return <div className={className}>{products.map(product => <InsuranceCard key={product.slug} product={product} illustrated={illustrated} />)}</div>
}
