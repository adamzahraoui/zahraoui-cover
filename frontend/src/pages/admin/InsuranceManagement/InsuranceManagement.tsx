import { useCallback, useRef, useState } from 'react'
import { AdminHeading, LocalFeedback } from '../../../components/admin/AdminContent'
import { useAdminSession } from '../../../components/admin/auth/AdminSession'
import { Button } from '../../../components/ui/Button'
import { Dialog } from '../../../components/ui/Dialog'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States'
import { insuranceNavigation } from '../../../config/navigation'
import type { ProductSlug } from '../../../config/navigation'
import { getInsurance } from '../../../data/insurance'
import { useApiData } from '../../../hooks/useApiData'
import { api, businessError } from '../../../services/api'
import type { CatalogWrite } from '../../../types/api'
import { CatalogEditor } from './CatalogEditor'

export default function InsuranceManagement() {
  const { state } = useAdminSession()
  const catalog = useApiData(api.adminCatalog)
  const dialog = useRef<HTMLDialogElement>(null)
  const [selected, setSelected] = useState<string>()
  const [sessionKey, setSessionKey] = useState(0)
  const [saved, setSaved] = useState(false)
  const loadDetail = useCallback((signal: AbortSignal) =>
    selected && selected !== 'new' ? api.adminProduct(selected, signal) : Promise.resolve(undefined), [selected])
  const detail = useApiData(loadDetail, String(sessionKey))
  const items = catalog.data ?? []
  const item = detail.data?.id === selected ? detail.data : undefined
  const canEdit = state.status === 'authenticated' && state.user.role === 'ADMIN'
  const allowed = insuranceNavigation.filter(entry => !items.some(row => row.slug === entry.slug)).map(entry => ({ value: entry.slug, label: entry.label }))

  function open(id: string) {
    setSelected(id)
    setSaved(false)
    setSessionKey(value => value + 1)
    dialog.current?.showModal()
  }

  async function save(values: CatalogWrite, slug: ProductSlug) {
    if (state.status !== 'authenticated') return
    const csrf = state.user.csrfToken
    if (item) {
      const { relatedSlugs, ...fields } = values
      const sameLinks = item.relatedSlugs.length === relatedSlugs.length && item.relatedSlugs.every(value => relatedSlugs.includes(value))
      await api.updateProduct(item.id, { ...fields, version: item.version, ...(sameLinks ? {} : { relatedSlugs }) }, csrf)
    } else await api.createProduct({ ...values, slug }, csrf)
    setSaved(true)
    catalog.reload()
    dialog.current?.close()
  }

  return (
    <>
      <AdminHeading title="Catalogue des assurances" action={canEdit && catalog.data && allowed.length ? <Button onClick={() => open('new')}>Ajouter une catégorie</Button> : undefined} />
      <p className="text-sm text-muted">Les six catégories sont réservées. Seuls les produits actifs et publiés sont visibles sur le site public.</p>
      {saved && <LocalFeedback>Produit enregistré.</LocalFeedback>}
      {catalog.loading && <LoadingState />}
      {catalog.error && <ErrorState>{businessError(catalog.error)} <Button variant="secondary" onClick={catalog.reload}>Réessayer</Button></ErrorState>}
      {catalog.data && !items.length && <EmptyState>Aucun produit dans le catalogue.</EmptyState>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(product => {
          const Icon = getInsurance(product.slug).icon
          return (
            <article className="panel flex flex-col items-start gap-3 p-4 sm:p-5" key={product.id}>
              <div className="flex w-full items-start justify-between gap-2"><Icon size={24} className="shrink-0 text-primary" aria-hidden /><StatusBadge label={!product.isActive ? 'Inactif' : product.isPublished ? 'Publié' : 'Non publié'} tone={product.isPublished ? 'success' : 'neutral'} /></div>
              <h2 className="font-semibold">{product.title}</h2>
              <p className="mb-2 flex-1 text-sm leading-6 text-muted">{product.summary}</p>
              <Button variant="secondary" aria-label={`${canEdit ? 'Modifier' : 'Consulter'} : ${product.title}`} onClick={() => open(product.id)}>{canEdit ? 'Modifier' : 'Consulter'}</Button>
            </article>
          )
        })}
      </div>
      <Dialog title={selected === 'new' ? 'Ajouter une catégorie' : item?.title ?? 'Détail de la catégorie'} dialogRef={dialog}>
        {selected && selected !== 'new' && detail.error
          ? <ErrorState>{businessError(detail.error)} <Button variant="secondary" onClick={detail.reload}>Recharger la fiche</Button></ErrorState>
          : selected === 'new' || item
            ? <CatalogEditor key={sessionKey} item={item} options={allowed} catalog={items} canEdit={canEdit} onSave={save} />
            : selected && <LoadingState />}
      </Dialog>
    </>
  )
}
