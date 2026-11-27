import { useState } from 'react'
import { Facts, LocalFeedback, RecordStatus } from '../../../components/admin/AdminContent'
import { activityDate } from '../../../components/admin/ActivityList'
import { useAdminSession } from '../../../components/admin/auth/AdminSession'
import { Button } from '../../../components/ui/Button'
import { ErrorState } from '../../../components/ui/States'
import { api, businessError } from '../../../services/api'
import type { Message, MessageStatus } from '../../../types/api'

export function MessageDetails({ record, save, reload }: { record: Message; save: (record: Message) => void; reload: () => void }) {
  const { state } = useAdminSession()
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')

  async function update(status?: MessageStatus) {
    if (state.status !== 'authenticated' || busy) return
    setBusy(true)
    setFeedback('')
    setError('')
    try {
      const csrf = state.user.csrfToken
      save(status ? await api.updateMessage(record.id, record.version, status, csrf) : await api.archiveMessage(record.id, record.version, csrf))
      setFeedback(status ? 'Message mis à jour.' : 'Message archivé.')
    } catch (failure) {
      setError(businessError(failure))
    } finally { setBusy(false) }
  }

  return (
    <section className="panel grid min-w-0 content-start gap-4 p-4 sm:p-5" aria-label="Détail du message">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold wrap-anywhere">{record.reference}</h2><RecordStatus status={record.status} /></div>
      <Facts items={[
        ['Expéditeur', record.fullName], ['Date', activityDate(record.createdAt)], ['Objet', record.subject],
        ['Téléphone', <a className="text-link" href={`tel:${record.phone}`}>{record.phone}</a>],
        ['Email', <a className="text-link" href={`mailto:${record.email}`}>{record.email}</a>],
        ['Notice lue', `${record.noticeVersion} · ${activityDate(record.acknowledgedAt)}`],
      ]} />
      <p className="rounded bg-background p-3 leading-7 whitespace-pre-wrap wrap-anywhere text-muted">{record.message}</p>
      {record.archivedAt ? <p className="text-sm text-muted">Archivé le {activityDate(record.archivedAt)}.</p> : (
        <div className="flex flex-wrap gap-2">
          {record.status !== 'PROCESSED' ? <>
            <Button variant="secondary" disabled={busy} onClick={() => { void update(record.status === 'UNREAD' ? 'READ' : 'UNREAD') }}>{record.status === 'UNREAD' ? 'Marquer comme lu' : 'Marquer comme non lu'}</Button>
            <Button disabled={busy} onClick={() => { void update('PROCESSED') }}>Marquer comme traité</Button>
          </> : <Button variant="secondary" disabled={busy} onClick={() => { void update() }}>Archiver le message</Button>}
        </div>
      )}
      {feedback && <LocalFeedback>{feedback}</LocalFeedback>}
      {error && <ErrorState>{error} <Button variant="secondary" onClick={reload}>Recharger le message</Button></ErrorState>}
    </section>
  )
}
