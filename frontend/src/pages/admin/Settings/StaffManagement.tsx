import { useCallback, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ActivityList } from '../../../components/admin/ActivityList'
import { Facts, LocalFeedback } from '../../../components/admin/AdminContent'
import { RecordList } from '../../../components/admin/RecordList'
import type { Column } from '../../../components/admin/RecordList'
import { Button } from '../../../components/ui/Button'
import { Dialog } from '../../../components/ui/Dialog'
import { Input, Select } from '../../../components/ui/Fields'
import { ErrorState, LoadingState } from '../../../components/ui/States'
import { useApiData } from '../../../hooks/useApiData'
import { api, businessError } from '../../../services/api'
import type { StaffAccount } from '../../../types/api'

const roles = [{ value: 'ADMIN', label: 'Administrateur' }, { value: 'ADVISOR', label: 'Conseiller' }]

export function StaffManagement({ csrf }: { csrf: string }) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [id, setId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const load = useCallback((signal: AbortSignal) => {
    const query = new URLSearchParams({ limit: '8', page: String(page) })
    if (search.trim().length >= 2) query.set('q', search.trim())
    return api.staff(query.toString(), signal)
  }, [page, search])
  const list = useApiData(load)
  const loadAccount = useCallback((signal: AbortSignal) => id ? api.staffAccount(id, signal) : Promise.resolve(undefined), [id])
  const detail = useApiData(loadAccount)
  const record = detail.data?.id === id ? detail.data : undefined

  function open(account?: StaffAccount) {
    setId(account?.id ?? ''); setError(''); setMessage(''); setConfirmRevoke(false)
    detail.reload()
    dialog.current?.showModal()
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const body = new FormData(event.currentTarget)
    const role = body.get('role') === 'ADMIN' ? 'ADMIN' : 'ADVISOR'
    const displayName = String(body.get('displayName') ?? '').trim()
    setBusy(true); setError(''); setMessage('')
    try {
      if (record) {
        const changed = await api.updateStaff(record.id, { displayName, role, version: record.version, isActive: body.has('isActive') }, csrf)
        detail.setData({ ...record, ...changed })
        detail.reload()
        setMessage('Compte mis à jour.')
      } else if (!id) {
        const invited = await api.inviteStaff({ displayName, role, email: String(body.get('email') ?? '').trim() }, csrf)
        setId(invited.id)
        setMessage('Invitation mise en file pour le SMTP de test.')
      }
      list.reload()
    } catch (error) { setError(businessError(error)) }
    finally { setBusy(false) }
  }
  async function act(action: 'invite' | 'revoke-sessions') {
    if (busy || !record) return
    setBusy(true); setError(''); setMessage('')
    try {
      detail.setData(await api.staffAction(record.id, action, record.version, csrf))
      setMessage(action === 'invite' ? 'Nouvelle invitation mise en file.' : 'Sessions révoquées.')
      setConfirmRevoke(false)
      list.reload()
    } catch (error) { setError(businessError(error)) }
    finally { setBusy(false) }
  }

  const columns: Column<StaffAccount>[] = [
    { title: 'Compte', render: row => <Button variant="secondary" className="wrap-anywhere text-left" onClick={() => open(row)}>{row.displayName}</Button> },
    { title: 'Email professionnel', render: row => row.email },
    { title: 'Rôle', render: row => roles.find(role => role.value === row.role)?.label },
    { title: 'État', render: row => !row.isActive ? 'Désactivé' : row.setupComplete ? 'Actif' : 'Invitation à compléter' },
  ]
  return <section id="personnel" className="panel grid gap-4 p-4 sm:p-6">
    <h2 className="text-lg font-semibold">Gestion du personnel</h2>
    <div className="grid items-end gap-3 sm:grid-cols-2">
      <Input label="Rechercher un compte" type="search" maxLength={100} value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} />
      {list.data?.inviteEnabled ? <div><Button variant="secondary" onClick={() => open()}>Inviter un membre</Button></div>
        : <p className="text-sm text-muted">Les invitations exigent le SMTP de test local.</p>}
    </div>
    {list.loading && <LoadingState />}
    {list.error && <ErrorState>{businessError(list.error)} <Button variant="secondary" onClick={list.reload}>Réessayer</Button></ErrorState>}
    {list.data && <RecordList rows={list.data.data} columns={columns} label="Comptes du personnel"
      pagination={{ ...list.data.meta, onPageChange: setPage }} />}
    <Dialog title={record?.displayName ?? (id ? 'Compte du personnel' : 'Inviter un membre')} dialogRef={dialog}>
      {id && detail.loading && !record && <LoadingState />}
      {id && detail.error && <ErrorState>{businessError(detail.error)} <Button variant="secondary" onClick={detail.reload}>Réessayer</Button></ErrorState>}
      {!id || record ? <form key={record ? record.id + ':' + record.version : 'invite'} className="grid gap-3" onSubmit={save}>
        <Input label="Nom affiché" name="displayName" required maxLength={120} defaultValue={record?.displayName} />
        {record ? <Facts items={[
          ['Email professionnel', record.email], ['Sessions actives', record.activeSessions],
          ['Configuration', record.setupComplete ? 'Mot de passe configuré' : 'Configuration en attente'],
        ]} /> : <Input label="Email professionnel" name="email" type="email" maxLength={254} required />}
        <Select label="Rôle" name="role" options={roles} defaultValue={record?.role ?? 'ADVISOR'} />
        {record && <>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={record.isActive} /> Compte actif</label>
          <p className="text-sm text-muted">Un changement de rôle ou d’état coupe les sessions du compte.</p>
        </>}
        <div><Button type="submit" disabled={busy}>{record ? 'Enregistrer le compte' : 'Envoyer l’invitation de test'}</Button></div>
      </form> : null}
      {record && <div className="mt-4 grid gap-3">
        {list.data?.inviteEnabled && record.isActive && !record.setupComplete &&
          <div><Button variant="secondary" disabled={busy} onClick={() => { void act('invite') }}>Renvoyer l’invitation</Button></div>}
        {confirmRevoke ? <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => { void act('revoke-sessions') }}>Confirmer la révocation</Button>
          <Button variant="secondary" onClick={() => setConfirmRevoke(false)}>Annuler</Button>
        </div> : <div><Button variant="secondary" disabled={busy} onClick={() => setConfirmRevoke(true)}>Révoquer les sessions</Button></div>}
        <h3 className="font-semibold">Activité du compte</h3>
        <ActivityList activity={record.activity} />
      </div>}
      {error && <ErrorState>{error}</ErrorState>}
      {message && <LocalFeedback>{message}</LocalFeedback>}
    </Dialog>
  </section>
}
