import { useState } from 'react'
import type { FormEvent } from 'react'
import { LocalFeedback } from '../../../components/admin/AdminContent'
import { Button } from '../../../components/ui/Button'
import { Input, Select } from '../../../components/ui/Fields'
import { ErrorState } from '../../../components/ui/States'
import { api, businessError } from '../../../services/api'
import type { ImportJob, ImportKind, ImportUpload, SpreadsheetFormat } from '../../../types/api'
import { importKinds, ImportReport } from './ImportReport'

export function ImportWizard({ csrf, enabled, onChange }: { csrf: string; enabled: boolean; onChange: () => void }) {
  const [step, setStep] = useState(1)
  const [kind, setKind] = useState<ImportKind>('CLIENTS')
  const [file, setFile] = useState<File>()
  const [upload, setUpload] = useState<ImportUpload>()
  const [job, setJob] = useState<ImportJob>()
  const [sheet, setSheet] = useState(0)
  const [mapping, setMapping] = useState<(string | null)[]>([])
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function startOver() {
    setStep(1); setFile(undefined); setUpload(undefined); setJob(undefined)
    setAccepted(false); setError('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!enabled || busy || !file) return
    setError('')
    setBusy(true)
    try {
      if (step === 1) {
        const format = file.name.split('.').at(-1)?.toLowerCase()
        if ((format !== 'csv' && format !== 'xlsx') || !file.size || file.size > 2 * 1024 * 1024) {
          setError('Choisissez un fichier CSV ou XLSX de 2 Mio maximum.')
          return
        }
        const data = await api.uploadImport(kind, format, file, csrf)
        setUpload(data)
        setJob(data)
        const firstSheet = Math.max(0, data.sheets.findIndex(entry => entry.headers.some(Boolean)))
        setSheet(firstSheet)
        setMapping(data.sheets[firstSheet].suggested)
        setStep(2)
        onChange()
      } else if (step === 2 && job) {
        setJob(await api.validateImport(job, file, sheet, mapping, csrf))
        setStep(3)
        onChange()
      } else if (step === 3 && job && accepted && !job.counts?.rejected) {
        setJob(await api.confirmImport(job, file, csrf))
        setStep(4)
        setFile(undefined)
        onChange()
      }
    } catch (failure) { setError(businessError(failure)) }
    finally { setBusy(false) }
  }

  if (!enabled) return <section className="panel p-4"><p>L’import est réservé aux essais locaux.</p></section>
  return <section className="panel grid min-w-0 gap-5 p-4 sm:p-6" aria-label="Importer des données">
    <ol className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
      {['Déposer', 'Associer', 'Valider', 'Résultat'].map((label, i) =>
        <li key={label} aria-current={step === i + 1 ? 'step' : undefined} className={step === i + 1 ? 'font-semibold text-primary' : 'text-muted'}>{i + 1}. {label}</li>)}
    </ol>
    <form className="grid min-w-0 gap-4" onSubmit={submit}>
      {step === 1 && <>
        <h2 className="text-lg font-semibold">Choisir les données et le fichier</h2>
        <Select label="Données à importer" value={kind} options={[...importKinds]} onChange={event => setKind(event.target.value as ImportKind)} />
        <div className="flex flex-wrap gap-3">
          {(['xlsx', 'csv'] satisfies SpreadsheetFormat[]).map(format => <a className="text-link" key={format}
            href={'/api/admin/imports/templates/' + kind + '?format=' + format} download>Télécharger le modèle {format.toUpperCase()}</a>)}
        </div>
        <Input label="Fichier à importer" name="file" type="file" accept=".xlsx,.csv" required
          hint="2 Mio maximum, 500 lignes de données. Gardez les téléphones et identifiants au format texte." onChange={event => setFile(event.target.files?.[0])} />
        <div><Button type="submit" disabled={busy}>{busy ? 'Lecture…' : 'Lire le fichier'}</Button></div>
      </>}
      {step === 2 && upload && <>
        <h2 className="text-lg font-semibold">Associer les colonnes</h2>
        {upload.previouslyImported && <p className="text-sm text-muted">Un import a déjà utilisé ce fichier. Le serveur vérifiera chaque ligne.</p>}
        <Select label="Feuille" value={String(sheet)} options={upload.sheets.map((entry, index) => ({ value: String(index), label: entry.name }))}
          onChange={event => { const index = Number(event.target.value); setSheet(index); setMapping(upload.sheets[index].suggested) }} />
        <p className="text-sm text-muted">Vérifiez les correspondances suggérées. Un champ ne peut être associé qu’une fois.</p>
        {kind === 'CLIENTS' && <p className="text-sm text-muted">Prévoyez un nom complet, un nom de famille ou une raison sociale selon le profil.</p>}
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">{upload.sheets[sheet].headers.map((header, index) => <Select
          key={index} label={header || 'Colonne ' + (index + 1)} value={mapping[index] ?? ''} placeholder="Ignorer la colonne" disabled={!header}
          options={upload.fields.map(field => ({ value: field.key, label: field.label + (field.required ? ' (obligatoire)' : '') }))}
          onChange={event => setMapping(current => current.map((value, n) => n === index ? event.target.value || null : value))} />)}</div>
        <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy}>{busy ? 'Validation…' : 'Valider et prévisualiser'}</Button>
          <Button variant="secondary" disabled={busy} onClick={startOver}>Changer de fichier</Button></div>
      </>}
      {step >= 3 && job && <>
        <h2 className="text-lg font-semibold">{step === 3 ? 'Vérifier les résultats' : 'Résultat de l’import'}</h2>
        {step === 4 && <LocalFeedback>Import enregistré.</LocalFeedback>}
        <ImportReport job={job} fields={upload?.fields} />
        {step === 3 && (job.counts?.rejected ? <ErrorState>Corrigez ou retirez les lignes invalides, puis déposez le fichier corrigé.</ErrorState> :
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 accent-primary" checked={accepted}
            onChange={event => setAccepted(event.target.checked)} /> Je confirme la création des dossiers proposés. Les doublons seront ignorés.</label>)}
        <div className="flex flex-wrap gap-2">
          {step === 3 && <>
            <Button type="submit" disabled={busy || !accepted || Boolean(job.counts?.rejected)}>{busy ? 'Import en cours…' : 'Confirmer l’import'}</Button>
            <Button variant="secondary" disabled={busy} onClick={() => { setStep(2); setAccepted(false); setError('') }}>Revoir les colonnes</Button>
          </>}
          <Button variant="secondary" disabled={busy} onClick={startOver}>{step === 3 ? 'Déposer un fichier corrigé' : 'Nouvel import'}</Button>
        </div>
      </>}
      {error && <ErrorState>{error}</ErrorState>}
    </form>
  </section>
}
