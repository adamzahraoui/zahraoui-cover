import { parse } from 'csv-parse/sync'
import { zipSync } from 'fflate'
import readWorkbook from 'read-excel-file/node'
import writeWorkbook from 'write-excel-file/node'
import yauzl from 'yauzl'
import { ApiError } from '../../middleware/errors.js'

export const uploadBytes = 2 * 1024 * 1024
export const expandedBytes = 8 * 1024 * 1024
export const maxRows = 500
export const maxColumns = 32
export const maxSheets = 8
const maxCell = 3000
const worksheet = /^xl\/worksheets\/sheet[1-9]\d*\.xml$/
const allowedPart = /^(?:\[Content_Types\]\.xml|_rels\/\.rels|docProps\/(?:app|core|custom)\.xml|xl\/(?:workbook|sharedStrings|styles)\.xml|xl\/_rels\/workbook\.xml\.rels|xl\/theme\/theme\d+\.xml|xl\/worksheets\/_rels\/sheet[1-9]\d*\.xml\.rels)$/
const directories = new Set(['_rels/', 'docProps/', 'xl/', 'xl/_rels/', 'xl/theme/', 'xl/worksheets/', 'xl/worksheets/_rels/'])
const decoder = new TextDecoder('utf-8', { fatal: true })
export const mime = { csv: 'text/csv', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
export type Format = keyof typeof mime
export type Cell = string | number | boolean | Date | null
export type Sheet = { name: string; headers: string[]; rows: { line: number; cells: Cell[] }[] }

function formatError(code = 'SPREADSHEET_INVALID', message = 'Le fichier ne correspond pas à un tableur pris en charge.') {
  return new ApiError(422, code, message)
}

function limitError() {
  return formatError('SPREADSHEET_LIMIT', 'Le tableur dépasse les limites de taille ou de dimensions.')
}

export function fold(value: string) {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function checkWorksheetXml(xml: string) {
  if (/<(?:[\w.-]+:)?(?:f|mergeCell|drawing|oleObject|hyperlink)(?=[\s/>])/i.test(xml)) {
    throw formatError('WORKBOOK_FEATURE', 'Les formules, liens et objets intégrés ne sont pas acceptés.')
  }
  let rows = 0
  let cells = 0
  for (const [, tag, attributes] of xml.matchAll(/<(?:[\w.-]+:)?(row|c)(?=\s|\/?>)([^>]*)>/g)) {
    const address = /(?:^|\s)r\s*=\s*["']([^"']+)["']/.exec(attributes)?.[1]
    if (tag === 'row') {
      if (++rows > maxRows + 1 || (address && (!/^\d{1,4}$/.test(address) || Number(address) > maxRows + 1))) throw limitError()
      continue
    }
    const coordinate = address && /^([A-Z]{1,2})([1-9]\d{0,3})$/.exec(address)
    if (++cells > (maxRows + 1) * maxColumns || !coordinate || Number(coordinate[2]) > maxRows + 1) throw limitError()
    const column = [...coordinate[1]].reduce((index, char) => index * 26 + char.charCodeAt(0) - 64, 0)
    if (column > maxColumns) throw limitError()
  }
}

async function inspectArchive(bytes: Buffer) {
  const zip = await yauzl.fromBufferPromise(bytes, { lazyEntries: true, strictFileNames: true, validateEntrySizes: true })
  let expanded = 0
  let sheetCount = 0
  let date1904 = false
  const entries = new Set<string>()
  const normalized: Record<string, Uint8Array> = {}
  try {
    if (zip.entryCount > 40) throw limitError()
    for await (const entry of zip.eachEntry()) {
      const name = entry.fileName
      if (entries.has(name) || (entry.generalPurposeBitFlag & 1) !== 0) throw formatError()
      entries.add(name)
      if (directories.has(name) && entry.uncompressedSize === 0) continue
      if (!allowedPart.test(name) && !worksheet.test(name)) throw formatError('WORKBOOK_FEATURE', 'Le classeur contient des éléments non pris en charge.')
      if (worksheet.test(name) && ++sheetCount > maxSheets) throw limitError()
      if (expanded + entry.uncompressedSize > expandedBytes) throw limitError()
      const stream = await zip.openReadStreamPromise(entry)
      const parts: Buffer[] = []
      for await (const chunk of stream as AsyncIterable<Buffer>) {
        expanded += chunk.length
        if (expanded > expandedBytes) throw limitError()
        parts.push(chunk)
      }
      const data = Buffer.concat(parts)
      const xml = decoder.decode(data)
      if (/<!\s*(?:DOCTYPE|ENTITY)|macroEnabled|vbaProject/i.test(xml) ||
          (name.endsWith('.rels') && /TargetMode\s*=\s*["']External["']/i.test(xml))) throw formatError('WORKBOOK_FEATURE', 'Les macros et liens externes ne sont pas acceptés.')
      if (worksheet.test(name)) checkWorksheetXml(xml)
      normalized[name] = data
      if (name === 'xl/workbook.xml') {
        if (/<(?:[\w.-]+:)?(?:definedName|externalReference)(?=[\s/>])/i.test(xml)) throw formatError('WORKBOOK_FEATURE', 'Les références de classeur ne sont pas prises en charge.')
        date1904 = /\bdate1904\s*=\s*["'](?:1|true)["']/i.test(xml)
        if (date1904) normalized[name] = Buffer.from(xml.replace(/(\bdate1904\s*=\s*)(["'])true\2/i, '$1"1"'))
      }
    }
    if (!entries.has('[Content_Types].xml') || !entries.has('xl/workbook.xml') || !sheetCount) throw formatError()
    // Pass only validated entries to the reader so a second ZIP parser sees the same package.
    return { date1904, workbookBytes: Buffer.from(zipSync(normalized, { level: 0 })) }
  } finally {
    zip.close()
  }
}

function asSheet(name: string, data: Cell[][]): Sheet {
  if (data.length > maxRows + 1 || data.some(row => row.length > maxColumns || row.some(cell => typeof cell === 'string' && cell.length > maxCell))) throw limitError()
  const headers = (data[0] ?? []).map(cell => typeof cell === 'string' ? cell.trim() : '')
  const values = headers.filter(Boolean).map(header => header.normalize('NFC').toLowerCase())
  if (new Set(values).size !== values.length) throw formatError('DUPLICATE_HEADERS', 'Les en-têtes de colonnes doivent être uniques.')
  const rows = data.slice(1).map((cells, i) => ({ line: i + 2, cells })).filter(row => row.cells.some(cell => cell !== null && cell !== ''))
  return { name, headers, rows }
}

function readCsv(bytes: Buffer) {
  const csv = decoder.decode(bytes)
  if (/[\p{Cc}]/u.test(csv.replace(/[\r\n\t]/g, ''))) throw formatError()
  const variants = [',', ';'].flatMap(delimiter => {
    try {
      const [header] = parse(csv, { delimiter, bom: true, trim: true, to: 1, max_record_size: maxColumns * maxCell }) as string[][]
      return header ? [{ delimiter, columns: header.length }] : []
    } catch { return [] }
  }).sort((a, b) => b.columns - a.columns)
  const choice = variants[0]
  if (!choice || (choice.columns > 1 && choice.columns === variants[1]?.columns)) throw formatError()
  let rows = 0
  const result = parse(csv, { delimiter: choice.delimiter, bom: true, trim: true, relax_column_count_less: true, max_record_size: maxColumns * maxCell,
    on_record: (record: string[]) => {
      if (++rows > maxRows + 1 || record.length > maxColumns) throw limitError()
      return record
    },
  }) as string[][]
  return asSheet('CSV', result)
}

export async function readSpreadsheet(bytes: Buffer, format: Format): Promise<{ sheets: Sheet[]; date1904: boolean }> {
  if (!bytes.length || bytes.length > uploadBytes) throw limitError()
  try {
    if (format === 'csv') return { sheets: [readCsv(bytes)], date1904: false }
    if (bytes.readUInt32LE(0) !== 0x04034b50) throw formatError()
    const { date1904, workbookBytes } = await inspectArchive(bytes)
    const workbook = await readWorkbook(workbookBytes)
    if (!workbook.length || workbook.length > maxSheets) throw limitError()
    return { sheets: workbook.map(({ sheet, data }) => asSheet(sheet, data)), date1904 }
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw formatError()
  }
}

export function csvCell(value: string) {
  const safe = /^(?:[\s\p{Cc}\p{Cf}]*[=+\-@＝＋－＠]|[\t\r\n])/u.test(value) ? "'" + value : value
  return '"' + safe.replaceAll('"', '""') + '"'
}

export async function writeSpreadsheet(format: Format, headers: string[], rows: string[][], title: string) {
  if (format === 'csv') return Buffer.from('\uFEFF' + [headers, ...rows].map(row => row.map(csvCell).join(';')).join('\r\n') + '\r\n')
  return writeWorkbook([
    headers.map(value => ({ value, type: String, fontWeight: 'bold', textColor: '#FFFFFF', backgroundColor: '#1B378A' })),
    ...rows.map(row => row.map(value => ({ value, type: String }))),
  ], { sheet: title, columns: headers.map(header => ({ width: Math.max(20, header.length + 4) })), stickyRowsCount: 1 }).toBuffer()
}
