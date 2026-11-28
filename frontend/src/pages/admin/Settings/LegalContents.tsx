import { useCallback, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { activityDate } from '../../../components/admin/ActivityList'
import { LocalFeedback } from '../../../components/admin/AdminContent'
import { RecordList } from '../../../components/admin/RecordList'
import type { Column } from '../../../components/admin/RecordList'
import { Button } from '../../../components/ui/Button'
import { Dialog } from '../../../components/ui/Dialog'
import { Select, Textarea } from '../../../components/ui/Fields'
import { ErrorState, LoadingState } from '../../../components/ui/States'
import { useApiData } from '../../../hooks/useApiData'
import { api, businessError } from '../../../services/api'
import type { AgencyContent, AgencyContentKind } from '../../../types/api'

const kinds = [
  { value: 'LEGAL', label: 'Mentions légales' }, { value: 'PRIVACY', label: 'Notice de confidentialité' },
  { value: 'COOKIES', label: 'Politique de cookies' }, { value: 'QUOTE', label: 'Texte des propositions' },
  { value: 'EMAIL', label: 'Texte des notifications' },
]

export function LegalContents({ csrf, refresh }: { csrf: string; refresh: () => void }) {
  const [kind, setKind] = useState<AgencyContentKind>('LEGAL')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<AgencyContent>()
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const load = useCallback((signal: AbortSignal) => api.agencyContent(kind, page, signal), [kind, page])
  const list = useApiData(load)

  function open(row?: AgencyContent) {
    setSelected(row); setError(''); setFeedback('')
    dialog.current?.showModal()
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = String(new FormData(event.currentTarget).get('body') ?? '').trim()
    if (busy) return
    setBusy(true); setError('')
    try {
      setSelected(selected ? await api.updateContent(selected.id, body, selected.version, csrf) : await api.createContent(kind, body, csrf))
      list.reload(); refresh(); setFeedback('Brouillon enregistré.')
    } catch (error) { setError(businessError(error)) }
    finally { setBusy(false) }
  }
  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || busy || !new FormData(event.currentTarget).has('approved')) return
    setBusy(true); setError('')
    try {
      setSelected(await api.publishContent(selected.id, selected.version, csrf))
      list.reload(); refresh(); setFeedback('Version publiée.')
    } catch (error) { setError(businessError(error)) }
    finally { setBusy(false) }
  }

  const columns: Column<AgencyContent>[] = [
    { title: 'Création', render: row => activityDate(row.createdAt) },
    { title: 'État', render: row => row.publishedAt ? 'Publiée' : 'Brouillon' },
    { title: 'Publication', render: row => row.publishedAt && <>{activityDate(row.publishedAt)} · {row.publisher?.displayName}</> },
    { title: 'Action', render: row => <Button variant="secondary" onClick={() => open(row)}>Ouvrir la version</Button> },
  ]

  return <section id="legal" className="panel grid min-w-0 gap-4 p-4 sm:p-6">
    <h2 className="text-lg font-semibold">Informations légales</h2>
    <p className="text-sm text-muted">Saisissez uniquement les textes fournis par l’agence. Publiez une version approuvée après relecture.</p>
    <div className="grid items-end gap-3 sm:grid-cols-2">
      <Select label="Type de contenu" value={kind} options={kinds} onChange={event => { setKind(event.target.value as AgencyContentKind); setPage(1) }} />
      <div><Button variant="secondary" onClick={() => open()}>Nouveau brouillon</Button></div>
    </div>
    {list.loading && <LoadingState />}
    {list.error && <ErrorState>{businessError(list.error)} <Button variant="secondary" onClick={list.reload}>Réessayer</Button></ErrorState>}
    {list.data && <RecordList rows={list.data.data} columns={columns} label="Versions du contenu"
      pagination={{ ...list.data.meta, onPageChange: setPage }} />}
    <Dialog title={kinds.find(item => item.value === kind)?.label ?? 'Contenu'} dialogRef={dialog}>
      <div className="grid gap-3">
        {selected?.publishedAt ? <>
          <p className="text-sm text-muted">Publiée le {activityDate(selected.publishedAt)} · {selected.publisher?.displayName}</p>
          <p className="whitespace-pre-wrap wrap-anywhere">{selected.body}</p>
        </> : <>
          <form className="grid gap-3" key={selected ? selected.id + ':' + selected.version : 'new'} onSubmit={save}>
            <Textarea label="Texte du contenu" name="body" minLength={20} maxLength={8000} required rows={8} defaultValue={selected?.body ?? ''} />
            <div><Button type="submit" disabled={busy}>Enregistrer le brouillon</Button></div>
          </form>
          {selected && <form key={selected.version} onSubmit={publish} className="grid gap-2 border-t border-line pt-3">
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="approved" className="mt-1 accent-primary" required /> Je confirme avoir relu et approuvé le brouillon enregistré.</label>
            <div><Button type="submit" variant="secondary" disabled={busy}>Publier la version</Button></div>
          </form>}
        </>}
        {error && <ErrorState>{error}</ErrorState>}
        {feedback && <LocalFeedback>{feedback}</LocalFeedback>}
      </div>
    </Dialog>
  </section>
}
