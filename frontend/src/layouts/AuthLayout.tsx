import { PageMain } from './PageMain'
import type { ReactNode } from 'react'
import { Brand } from '../components/public/Brand'

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <PageMain className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center"><Brand /></div>
        <section className="panel grid gap-5 p-5 sm:p-8">{children}</section>
      </div>
    </PageMain>
  )
}
