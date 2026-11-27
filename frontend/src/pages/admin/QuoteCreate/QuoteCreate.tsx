import { useSearchParams } from 'react-router-dom'
import { AdminHeading, NoRecord } from '../../../components/admin/AdminContent'
import { useDemoData } from '../../../components/admin/DemoData'
import { QuoteEditor } from '../../../components/admin/QuoteEditor'

export default function QuoteCreate() {
  const { data } = useDemoData()
  const [params] = useSearchParams()
  const id = params.get('demande')
  const request = data.requests.find(row => row.id === id)
  if (id && !request) return <NoRecord title="Demande introuvable" back="/admin/demandes" />
  return (
    <>
      <AdminHeading title="Nouveau devis" parent={{ label: 'Devis', to: '/admin/devis' }} />
      <QuoteEditor key={id ?? 'new'} request={request} />
    </>
  )
}
