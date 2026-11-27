import { ApiError } from '../../middleware/errors.js'
import { maxPdfBytes } from '../quotes/files.js'

export function validPolicyPdf(bytes: Buffer) {
  if (bytes.length < 32 || bytes.length > maxPdfBytes || !/^%PDF-(?:1\.[0-7]|2\.0)(?:\r|\n)/.test(bytes.subarray(0, 12).toString('latin1'))) return false
  const footer = /startxref\s+(\d+)\s+%%EOF\s*$/.exec(bytes.subarray(-256).toString('latin1'))
  if (!footer) return false
  const index = Number(footer[1])
  if (!Number.isSafeInteger(index) || index < 9 || index >= bytes.length || !/^xref\s/.test(bytes.subarray(index, index + 6).toString('latin1'))) return false
  // The local-only upload path rejects detectable active content. These checks are not malware scanning.
  const content = bytes.toString('latin1').replace(/#([a-f0-9]{2})/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
  return !/\/(?:JS|JavaScript|Launch|EmbeddedFile|RichMedia|OpenAction|AA|XFA|Encrypt|ObjStm)\b/i.test(content)
}

export function documentName(header: string | undefined, required: boolean) {
  if (header === undefined && !required) return undefined
  let name = ''
  try { name = decodeURIComponent(header ?? '').normalize('NFC').trim() } catch { /* invalid encoded filename */ }
  if (name.length < 5 || name.length > 180 || !/\.pdf$/i.test(name) || /[\p{Cc}\p{Cf}/\\]/u.test(name) || name.startsWith('.')) {
    throw new ApiError(422, 'DOCUMENT_FILENAME', 'Indiquez un nom de fichier PDF valide.')
  }
  return name
}
