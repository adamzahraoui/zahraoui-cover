import { createContext, useContext, useState } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { demoClients, demoContracts, demoQuotes, demoRequests } from '../../data/demo'
import type { CatalogItem, DemoClient, DemoContract, DemoPartner, DemoQuote, DemoRequest, DemoSettings } from '../../data/demo'
import { insurance } from '../../data/insurance'

type DemoData = {
  requests: DemoRequest[]
  clients: DemoClient[]
  quotes: DemoQuote[]
  contracts: DemoContract[]
  catalog: CatalogItem[]
  partners: DemoPartner[]
  settings: DemoSettings
}

const initialData: DemoData = {
  requests: demoRequests,
  clients: demoClients,
  quotes: demoQuotes,
  contracts: demoContracts,
  catalog: insurance.map(item => ({ slug: item.slug, summary: item.summary, published: true })),
  partners: [],
  settings: { email: '', address: '', hours: '' },
}

const DemoContext = createContext<{ data: DemoData; setData: Dispatch<SetStateAction<DemoData>> } | null>(null)

export function DemoDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(initialData)
  return <DemoContext.Provider value={{ data, setData }}>{children}</DemoContext.Provider>
}

export function useDemoData() {
  const value = useContext(DemoContext)
  if (!value) throw new Error('Le contexte de démonstration est indisponible.')
  return value
}
