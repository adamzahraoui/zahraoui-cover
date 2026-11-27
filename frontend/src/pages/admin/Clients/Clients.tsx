import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminHeading } from '../../../components/admin/AdminContent'
import { useDemoData } from '../../../components/admin/DemoData'
import { RecordList } from '../../../components/admin/RecordList'
import type { Column } from '../../../components/admin/RecordList'
import { ActionLink } from '../../../components/ui/Button'
import { Input, Select } from '../../../components/ui/Fields'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import type { DemoClient } from '../../../data/demo'
import { profiles } from '../../../utils/admin'
import { searchable } from '../../../utils/forms'

export default function Clients() {
  const { data } = useDemoData()
  const [query, setQuery] = useState('')
  const [profile, setProfile] = useState('')
  const [archived, setArchived] = useState(false)
  const rows = data.clients.filter(row => (
    (archived || !row.archived) && (!profile || row.profile === profile)
    && searchable(`${row.displayName} ${row.phone} ${row.city ?? ''}`).includes(searchable(query))
  ))
  const columns: Column<DemoClient>[] = [
    { title: 'Client', render: row => <Link className="text-link" to={`/admin/clients/${row.id}`}>{row.displayName}</Link> },
    { title: 'Type', render: row => profiles.find(item => item.value === row.profile)?.label },
    { title: 'Téléphone', render: row => row.phone },
    { title: 'Ville', render: row => row.city || '—' },
    { title: 'Contrats actifs', render: row => data.contracts.filter(contract => contract.clientId === row.id && contract.status === 'ACTIVE').length },
    { title: 'État', render: row => <StatusBadge label={row.archived ? 'Archivé' : 'Actif'} tone={row.archived ? 'neutral' : 'success'} /> },
  ]

  return (
    <>
      <AdminHeading title="Clients" action={<ActionLink to="/admin/clients/nouveau"><Plus size={16} aria-hidden /> Ajouter un client</ActionLink>} />
      <div className="panel grid items-end gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        <Input label="Rechercher un client" type="search" placeholder="Nom, téléphone ou ville" value={query} onChange={event => setQuery(event.target.value)} maxLength={100} />
        <Select label="Profil" value={profile} placeholder="Tous les profils" options={profiles} onChange={event => setProfile(event.target.value)} />
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium"><input type="checkbox" checked={archived} onChange={event => setArchived(event.target.checked)} className="size-4 accent-primary" /> Afficher les archives</label>
      </div>
      <RecordList key={JSON.stringify([query, profile, archived])} rows={rows} columns={columns} label="Liste des clients" />
    </>
  )
}
