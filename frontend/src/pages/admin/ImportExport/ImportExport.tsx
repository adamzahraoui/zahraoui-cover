import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { activityDate } from '../../../components/admin/ActivityList'
import { AdminHeading } from '../../../components/admin/AdminContent'
import { RecordList } from '../../../components/admin/RecordList'
import type { Column } from '../../../components/admin/RecordList'
import { useAdminSession } from '../../../components/admin/auth/AdminSession'
import { Button } from '../../../components/ui/Button'
import { ErrorState, LoadingState } from '../../../components/ui/States'
import { useApiData } from '../../../hooks/useApiData'
import { api, businessError } from '../../../services/api'
import type { ImportJob } from '../../../types/api'
import { ExportForm } from './ExportForm'
import { importKinds, ImportReport, importStatuses } from './ImportReport'
import { ImportWizard } from './ImportWizard'

const sections = [
  { key: 'import', label: 'Importer des données' },
  { key: 'export', label: 'Exporter des données' },
  { key: 'history', label: 'Historique des importations' },
]

const columns: Column<ImportJob>[] = [
  { title: 'Import', render: job => <Link className="text-link" to={'?section=history&job=' + job.id}>{importKinds.find(kind => kind.value === job.kind)?.label}</Link> },
  { title: 'Date', render: job => activityDate(job.createdAt) },
  { title: 'État', render: job => importStatuses[job.status] },
  { title: 'Administrateur', render: job => job.administrator },
  { title: 'Créés', render: job => job.counts?.created ?? '—' },
]

export default function ImportExport() {
  const { state } = useAdminSession()
  const [params, setParams] = useSearchParams()
  const section = params.get('section') ?? 'import'
  const jobId = params.get('job')
  const [page, setPage] = useState(1)
  const load = useCallback((signal: AbortSignal) => api.imports(page, signal), [page])
  const loadJob = useCallback((signal: AbortSignal) => jobId ? api.importJob(jobId, signal) : Promise.resolve(undefined), [jobId])
  const history = useApiData(load)
  const report = useApiData(loadJob)
  const job = report.data?.id === jobId ? report.data : undefined

  return <>
    <AdminHeading title="Import / Export" />
    <nav aria-label="Import et export" className="flex flex-wrap gap-2">
      {sections.map(item => <Button key={item.key} variant={section === item.key ? 'primary' : 'secondary'} aria-pressed={section === item.key}
        onClick={() => setParams({ section: item.key })}>{item.label}</Button>)}
    </nav>
    {section === 'import' && (!history.data
      ? history.error ? <ErrorState>{businessError(history.error)} <Button variant="secondary" onClick={history.reload}>Réessayer</Button></ErrorState> : <LoadingState />
      : state.status === 'authenticated' && <ImportWizard csrf={state.user.csrfToken} enabled={history.data.importEnabled} onChange={history.reload} />)}
    {section === 'export' && <ExportForm />}
    {section === 'history' && <section className="grid gap-4">
      <h2 className="text-lg font-semibold">Historique des importations</h2>
      {history.loading && <LoadingState />}
      {history.error && <ErrorState>{businessError(history.error)} <Button variant="secondary" onClick={history.reload}>Réessayer</Button></ErrorState>}
      {history.data && <RecordList label="Imports enregistrés" rows={history.data.data} columns={columns}
        pagination={{ ...history.data.meta, onPageChange: setPage }} />}
      {jobId && <div className="panel grid gap-4 p-4 sm:p-6">
        <h3 className="font-semibold">Rapport détaillé</h3>
        {report.loading && <LoadingState />}
        {report.error && <ErrorState>{businessError(report.error)} <Button variant="secondary" onClick={report.reload}>Réessayer</Button></ErrorState>}
        {job && <ImportReport job={job} />}
      </div>}
    </section>}
  </>
}
