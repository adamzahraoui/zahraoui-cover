import { useEffect, useState } from 'react'

export function useApiData<T>(load: (signal: AbortSignal) => Promise<T>, requestKey?: string) {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<{ data?: T; loading: boolean; error?: Error }>({ loading: true })

  useEffect(() => {
    const controller = new AbortController()
    setState(previous => ({ data: previous.data, loading: true }))
    load(controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ data, loading: false })
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setState({ error: error instanceof Error ? error : new Error('Chargement impossible.'), loading: false })
    })
    return () => controller.abort()
  }, [load, revision, requestKey])

  return {
    ...state,
    reload: () => setRevision(value => value + 1),
    setData: (data: T) => setState({ data, loading: false }),
  }
}
