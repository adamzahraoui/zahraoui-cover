export function validPhone(value: string) {
  const compact = value.trim().replace(/[\s().-]/g, '')
  return /^(?:0[5-7]\d{8}|\+[1-9]\d{7,14})$/.test(compact)
}

export function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export function casablancaToday() {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Africa/Casablanca', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts()
  const part = (name: string) => parts.find(item => item.type === name)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function searchable(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr').trim()
}
