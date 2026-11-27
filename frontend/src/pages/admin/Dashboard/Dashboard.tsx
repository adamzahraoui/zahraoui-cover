import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { activityNames, activityDate } from '../../../components/admin/ActivityList'
import { AdminHeading } from '../../../components/admin/AdminContent'
import { IssuedQuoteList } from '../../../components/admin/IssuedQuoteList'
import { RequestList } from '../../../components/admin/RequestList'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Fields'
import { useApiData } from '../../../hooks/useApiData'
import { api, businessError } from '../../../services/api'
import type { QuoteStatus } from '../../../types/api'
import { ErrorState, LoadingState } from '../../../components/ui/States'

const quickLinks = [
  { label: 'Demandes', to: '/admin/demandes' },
  { label: 'Clients', to: '/admin/clients' },
  { label: 'Devis', to: '/admin/devis' },
  { label: 'Assistance', to: '/admin/assistance' },
]

export default function Dashboard() {
  const { data, loading, error, reload } = useApiData(api.dashboard)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const indicators = data ? [
    { label: 'Demandes de devis', count: data.counts.totalRequests, to: '/admin/demandes', color: 'text-primary' },
    { label: 'Nouvelles demandes', count: data.counts.newRequests, to: '/admin/demandes?status=NEW', color: 'text-secondary' },
    { label: 'En cours d’étude', count: data.counts.inReviewRequests, to: '/admin/demandes?status=IN_REVIEW', color: 'text-ink' },
  ] : []
  const months = (data?.months ?? []).map(month => ({
    label: new Intl.DateTimeFormat('fr-MA', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month.month}-01T00:00:00Z`)),
    count: month.count,
  }))
  const topMonth = Math.max(1, ...months.map(month => month.count))
  const operations = data ? [
    { label: 'Total clients', count: data.counts.totalClients, to: '/admin/clients' },
    { label: 'Clients provisoires', count: data.counts.provisionalClients, to: '/admin/clients?provisional=true' },
    { label: 'Messages non lus', count: data.counts.unreadMessages, to: '/admin/messages?status=UNREAD' },
    { label: 'Nouvelles assistances', count: data.counts.newAssistance, to: '/admin/assistance?status=NEW' },
    { label: 'Assistances en cours', count: data.counts.inReviewAssistance, to: '/admin/assistance?status=IN_PROGRESS' },
  ] : []
  const quoteIndicators: { status: QuoteStatus; label: string }[] = [
    { status: 'DRAFT', label: 'Brouillons' }, { status: 'ISSUED', label: 'En attente d’envoi' },
    { status: 'SENT', label: 'Envoyés' }, { status: 'ACCEPTED', label: 'Acceptés' },
    { status: 'DECLINED', label: 'Refusés' }, { status: 'EXPIRED', label: 'Expirés' },
  ]
  const activityPaths: Record<string, string> = {
    quote_request: '/admin/demandes/', quote: '/admin/devis/', client: '/admin/clients/', contact_message: '/admin/messages?id=', assistance_case: '/admin/assistance?id=',
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    navigate(query.trim() ? `/admin/demandes?q=${encodeURIComponent(query.trim())}` : '/admin/demandes')
  }

  return (
    <>
      <AdminHeading title="Tableau de bord" action={(
        <form onSubmit={search} className="flex w-full min-w-0 items-end gap-2 sm:w-auto">
          <Input label="Rechercher un dossier" type="search" value={query} onChange={event => setQuery(event.target.value)} maxLength={100} />
          <Button type="submit" variant="secondary">Rechercher</Button>
        </form>
      )} />
      {loading && <LoadingState />}
      {error && <ErrorState>{businessError(error)} <Button variant="secondary" onClick={reload}>Réessayer</Button></ErrorState>}
      {data && <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {indicators.map(({ label, count, to, color }) => (
          <Link to={to} key={to} className="panel grid gap-1 p-3 hover:border-soft-blue sm:p-4">
            <span className="text-sm text-muted">{label}</span>
            <span className={`text-2xl font-bold tabular-nums lg:text-[32px] ${color}`}>{count}</span>
          </Link>
        ))}
      </div>
      <section className="grid gap-3">
        <h2 className="font-semibold">Propositions d’assurance</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {quoteIndicators.map(({ status, label }) => <Link key={status} to={`/admin/devis?status=${status}`} className="panel grid gap-1 p-3 hover:border-soft-blue sm:p-4">
            <span className="text-sm text-muted">{label}</span><span className="text-2xl font-bold tabular-nums text-primary">{data.quoteCounts[status] ?? 0}</span>
          </Link>)}
        </div>
      </section>
      <section className="grid gap-3">
        <h2 className="font-semibold">Clients et assistance</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {operations.map(({ label, count, to }) => <Link key={to} to={to} className="panel grid gap-1 p-3 hover:border-soft-blue sm:p-4">
            <span className="text-sm text-muted">{label}</span><span className="text-2xl font-bold tabular-nums text-primary">{count}</span>
          </Link>)}
        </div>
      </section>
      <section className="panel grid gap-3 p-4 lg:hidden">
        <h2 className="font-semibold">Accès rapide</h2>
        <div className="grid grid-cols-2 gap-2">{quickLinks.map(({ label, to }) => <Link to={to} key={to} className="text-link rounded border border-line bg-background p-3 text-sm">{label}</Link>)}</div>
      </section>
      <div className="hidden gap-4 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="panel p-5">
          <h2 className="mb-4 font-semibold">Activité mensuelle des demandes</h2>
          {!months.length && <p className="text-sm text-muted">Aucune activité enregistrée.</p>}
          <ul className="flex min-h-45 items-end justify-around gap-2 border-b border-line pt-4">
            {months.map(({ label, count }) => (
              <li key={label} className="grid min-w-0 justify-items-center gap-2">
                <span className="text-sm font-semibold text-primary">{count}</span>
                <span className="w-10 rounded-t-sm bg-primary" style={{ height: `${(count / topMonth) * 114}px` }} aria-hidden />
                <span className="pb-2 text-center text-sm text-muted">{label}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel p-5">
          <h2 className="mb-4 font-semibold">Répartition par catégorie</h2>
          <dl className="grid gap-3 text-sm">
            {data.byProduct.map(({ slug, title, count }) => (
                <div key={slug} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1">
                  <dt className="text-muted">{title}</dt><dd className="font-semibold">{count}</dd>
                  <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-surface-tint" aria-hidden>
                    <span className="block h-full rounded-full bg-secondary" style={{ width: `${count * 100 / Math.max(1, data.counts.totalRequests)}%` }} />
                  </span>
                </div>
            ))}
          </dl>
        </section>
      </div>
      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Demandes récentes</h2><Link to="/admin/demandes" className="text-link text-sm">Voir les demandes</Link></div>
        <RequestList rows={data.recentRequests} label="Demandes récentes" />
      </section>
      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Devis émis récemment</h2><Link to="/admin/devis" className="text-link text-sm">Voir les devis</Link></div>
        <IssuedQuoteList rows={data.recentQuotes} label="Devis émis récemment" />
      </section>
      <section className="panel grid gap-3 p-4 sm:p-5">
        <h2 className="font-semibold">Activité récente</h2>
        {data.activity.length ? <ul className="grid gap-2">
          {data.activity.map(event => <li key={event.id} className="flex flex-wrap justify-between gap-2 text-sm">
            {event.targetId && event.targetType && activityPaths[event.targetType] ? <Link to={activityPaths[event.targetType] + event.targetId} className="text-link">{activityNames[event.action] ?? 'Dossier mis à jour'}</Link> : <span>{activityNames[event.action] ?? 'Dossier mis à jour'}</span>}
            <time dateTime={event.createdAt} className="text-muted">{activityDate(event.createdAt)}</time>
          </li>)}
        </ul> : <p className="text-sm text-muted">Aucune activité récente.</p>}
      </section>
      </>}
    </>
  )
}
