import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { useApiData } from '../hooks/useApiData'
import { api } from '../services/api'
import type { PublicAgency } from '../types/api'
import { company as defaults } from './company'

const CompanyContext = createContext<PublicAgency | undefined>(undefined)

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { data } = useApiData(api.agency)
  return <CompanyContext.Provider value={data}>{children}</CompanyContext.Provider>
}

function displayPhone(value: string) {
  return value.replace(/^(\+212)(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3 $4')
}

export function useCompany() {
  const publicAgency = useContext(CompanyContext)
  const phone = (value: string | undefined, fallback: typeof defaults.office | typeof defaults.assistance) =>
    value ? { label: fallback.label, number: displayPhone(value), href: 'tel:' + value } : fallback
  return {
    ...defaults, name: publicAgency?.agencyName ?? defaults.name, publicAgency,
    office: phone(publicAgency?.officePhone, defaults.office),
    assistance: phone(publicAgency?.assistancePhone, defaults.assistance),
  }
}
