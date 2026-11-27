import { createContext, useContext, useState } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import type { DemoSettings } from '../../data/demo'

type DemoData = { settings: DemoSettings }

const initialData: DemoData = {
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
