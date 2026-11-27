import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AdminHeading } from '../../../components/admin/AdminContent'
import { useDemoData } from '../../../components/admin/DemoData'
import { RequestList } from '../../../components/admin/RequestList'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Fields'
import { insuranceNavigation } from '../../../config/navigation'

const quickLinks = [
  { label: 'Demandes', to: '/admin/demandes' },
  { label: 'Clients', to: '/admin/clients' },
  { label: 'Devis', to: '/admin/devis' },
  { label: 'Assistance', to: '/admin/assistance' },
]

export default function Dashboard() {
  const { data } = useDemoData()
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const indicators = [
    { label: 'Demandes de devis', count: data.requests.length, to: '/admin/demandes', color: 'text-primary' },
    { label: 'Nouvelles demandes', count: data.requests.filter(row => row.status === 'NEW').length, to: '/admin/demandes?status=NEW', color: 'text-secondary' },
    { label: 'En cours d’étude', count: data.requests.filter(row => row.status === 'IN_REVIEW').length, to: '/admin/demandes?status=IN_REVIEW', color: 'text-ink' },
    { label: 'Devis acceptés', count: data.quotes.filter(row => row.status === 'ACCEPTED').length, to: '/admin/devis?status=ACCEPTED', color: 'text-success' },
  ]
  const months = Array.from(new Set(data.requests.map(row => row.date.slice(0, 7)))).sort().map(month => ({
    label: new Intl.DateTimeFormat('fr-MA', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`)),
    count: data.requests.filter(row => row.date.startsWith(month)).length,
  }))
  const topMonth = Math.max(1, ...months.map(month => month.count))
  const recent = data.requests.slice(0, 4)

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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {indicators.map(({ label, count, to, color }) => (
          <Link to={to} key={to} className="panel grid gap-1 p-3 hover:border-soft-blue sm:p-4">
            <span className="text-sm text-muted">{label}</span>
            <span className={`text-2xl font-bold tabular-nums lg:text-[32px] ${color}`}>{count}</span>
          </Link>
        ))}
      </div>
      <section className="panel grid gap-3 p-4 lg:hidden">
        <h2 className="font-semibold">Accès rapide</h2>
        <div className="grid grid-cols-2 gap-2">{quickLinks.map(({ label, to }) => <Link to={to} key={to} className="text-link rounded border border-line bg-background p-3 text-sm">{label}</Link>)}</div>
      </section>
      <div className="hidden gap-4 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="panel p-5">
          <h2 className="mb-4 font-semibold">Activité mensuelle des demandes</h2>
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
            {insuranceNavigation.map(({ slug, label }) => {
              const count = data.requests.filter(row => row.product === slug).length
              return (
                <div key={slug} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1">
                  <dt className="text-muted">{label}</dt><dd className="font-semibold">{count}</dd>
                  <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-surface-tint" aria-hidden>
                    <span className="block h-full rounded-full bg-secondary" style={{ width: `${count * 100 / Math.max(1, data.requests.length)}%` }} />
                  </span>
                </div>
              )
            })}
          </dl>
        </section>
      </div>
      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Demandes récentes</h2><Link to="/admin/demandes" className="text-link text-sm">Voir les demandes</Link></div>
        <RequestList rows={recent} label="Demandes récentes de démonstration" />
      </section>
    </>
  )
}
