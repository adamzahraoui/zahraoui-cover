import assert from 'node:assert/strict'
import { test } from 'node:test'
import { unzipSync, zipSync } from 'fflate'
import writeWorkbook from 'write-excel-file/node'
import { checkMapping, recommended } from '../src/modules/imports/columns.js'
import { insuranceDate } from '../src/modules/imports/records.js'
import { csvCell, expandedBytes, readSpreadsheet, writeSpreadsheet } from '../src/modules/imports/spreadsheets.js'

test('CSV preserves UTF-8, quoted delimiters, leading zeros and blank-row positions', async () => {
  const { sheets } = await readSpreadsheet(Buffer.from('\uFEFFNom;Téléphone\r\n"Élise; Nadia";0600010011\r\n;\r\nOmar;0600010012\r\n'), 'csv')
  assert.deepEqual(sheets[0].headers, ['Nom', 'Téléphone'])
  assert.deepEqual(sheets[0].rows, [{ line: 2, cells: ['Élise; Nadia', '0600010011'] }, { line: 4, cells: ['Omar', '0600010012'] }])
  assert.deepEqual((await readSpreadsheet(Buffer.from('Nom,Ville\n"Nadia, Amal",Fès\n'), 'csv')).sheets[0].rows[0].cells, ['Nadia, Amal', 'Fès'])
  await assert.rejects(readSpreadsheet(Buffer.from([0xff, 0x00]), 'csv'), { code: 'SPREADSHEET_INVALID' })
  await assert.rejects(readSpreadsheet(Buffer.from('Nom;nom\nAmal;Nadia'), 'csv'), { code: 'DUPLICATE_HEADERS' })
})

test('XLSX round-trips Unicode and literal text, validates actual content and bounds ZIP expansion', async () => {
  const bytes = await writeSpreadsheet('xlsx', ['Référence historique', 'Nom complet'], [['000123', 'Élise']], 'Clients')
  const decoded = await readSpreadsheet(bytes, 'xlsx')
  assert.deepEqual(decoded.sheets[0].rows[0].cells, ['000123', 'Élise'])
  await assert.rejects(readSpreadsheet(Buffer.from('not a workbook'), 'xlsx'), { code: 'SPREADSHEET_INVALID' })
  const parts = unzipSync(bytes)
  const unsafeFormula = Buffer.from(parts['xl/worksheets/sheet1.xml']).toString().replace('</sheetData>', '<row r="3"><c r="A3"><f>1+1</f><v>2</v></c></row></sheetData>')
  await assert.rejects(readSpreadsheet(Buffer.from(zipSync({ ...parts, 'xl/worksheets/sheet1.xml': Buffer.from(unsafeFormula) })), 'xlsx'), { code: 'WORKBOOK_FEATURE' })
  await assert.rejects(readSpreadsheet(Buffer.from(zipSync({ ...parts, 'xl/sharedStrings.xml': Buffer.alloc(expandedBytes + 1, 32) })), 'xlsx'), { code: 'SPREADSHEET_LIMIT' })
  await assert.rejects(readSpreadsheet(Buffer.from(zipSync({ ...parts, 'xl/vbaProject.bin': Buffer.from('synthetic') })), 'xlsx'), { code: 'WORKBOOK_FEATURE' })
})

test('date epochs, French dates and spreadsheet formula protection are explicit', async () => {
  assert.equal(insuranceDate('2025-11-27', false), '2025-11-27')
  assert.equal(insuranceDate('27/11/2025', false), '2025-11-27')
  assert.equal(insuranceDate('03/04/2025', false), undefined)
  assert.equal(insuranceDate(60, false), undefined)
  assert.equal(insuranceDate(1, true), '1904-01-02')
  assert.equal(insuranceDate(61, false), '1900-03-01')
  const csv = (await writeSpreadsheet('csv', ['Nom'], [['=1+2'], ['\u00a0@SUM(1)'], ['Élise']], 'Test')).toString()
  assert.match(csv, /"'=1\+2"/)
  assert.match(csv, /"'\u00a0@SUM/)
  assert.equal(csvCell('A "B"'), '"A ""B"""')
})

test('unambiguous aliases suggest mappings and conflicting suggestions remain unassigned', () => {
  assert.deepEqual(recommended('CLIENTS', ['Type de client', 'Nom complet', 'Tél.', 'Code historique']), ['profile', 'displayName', 'phone', 'legacyReference'])
  assert.deepEqual(recommended('CLIENTS', ['Téléphone', 'Portable']), [null, null])
  assert.throws(() => checkMapping('CLIENTS', ['Type', 'Nom', 'Mobile'], ['profile', 'displayName', 'displayName']), { code: 'IMPORT_MAPPING' })
})

test('a workbook with the 1904 flag retains styled dates and selectable worksheets', async () => {
  const workbook = await writeWorkbook([
    { sheet: 'Instructions', data: [['Consignes']] },
    { sheet: 'Contrats', data: [['Date'], [{ value: 1, type: Number, format: 'mm-dd-yyyy' }]] },
  ]).toBuffer()
  const parts = unzipSync(workbook)
  const workbookXml = Buffer.from(parts['xl/workbook.xml']).toString()
  parts['xl/workbook.xml'] = Buffer.from(workbookXml.replace(/(<workbookPr[^>]*>)/, '').replace('<sheets>', '<workbookPr date1904="true"/><sheets>'))
  const decoded = await readSpreadsheet(Buffer.from(zipSync(parts)), 'xlsx')
  assert.equal(decoded.date1904, true)
  assert.deepEqual(decoded.sheets.map(sheet => sheet.name), ['Instructions', 'Contrats'])
  assert.equal(insuranceDate(decoded.sheets[1].rows[0].cells[0], decoded.date1904), '1904-01-02')
})
