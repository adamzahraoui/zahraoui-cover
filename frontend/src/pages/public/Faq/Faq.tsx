import { useState } from 'react'
import { Accordion, PageHeading } from '../../../components/public/PublicSections'
import { ActionLink, Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Fields'
import { EmptyState } from '../../../components/ui/States'
import { faqs, topics } from '../../../data/faq'
import { searchable } from '../../../utils/forms'

export default function Faq() {
  const [query, setQuery] = useState('')
  const [topic, setTopic] = useState<typeof topics[number]>('Toutes')
  const matches = faqs.filter(entry =>
    (topic === 'Toutes' || entry.topic === topic) && searchable(`${entry.question} ${entry.answer}`).includes(searchable(query)),
  )
  return (
    <>
      <PageHeading title="Foire aux questions" description="Consultez les réponses sur le courtage, les demandes de devis et l’assistance." />
      <section className="site-container section-space grid gap-5">
        <div className="max-w-xl"><Input label="Rechercher une question" type="search" placeholder="Ex. demande de devis" value={query} onChange={event => setQuery(event.target.value)} maxLength={100} /></div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Catégories de questions">
          {topics.map(item => <button key={item} type="button" aria-pressed={topic === item} className="action border border-line-strong bg-white text-primary hover:bg-primary-tint aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-white" onClick={() => setTopic(item)}>{item}</button>)}
        </div>
        <span className="sr-only" role="status">{matches.length} questions affichées.</span>
        {matches.length
          ? <div className="grid gap-3">{matches.map(entry => <Accordion key={entry.question} question={entry.question}>{entry.answer}</Accordion>)}</div>
          : <EmptyState><p>Aucune question ne correspond à votre recherche.</p><Button variant="secondary" onClick={() => { setQuery(''); setTopic('Toutes') }}>Effacer les filtres</Button></EmptyState>}
      </section>
      <section className="border-t border-line bg-white">
        <div className="site-container flex flex-wrap items-center justify-between gap-4 py-9"><h2 className="text-xl font-bold">Vous n’avez pas trouvé votre réponse ?</h2><ActionLink to="/contact">Nous contacter</ActionLink></div>
      </section>
    </>
  )
}
