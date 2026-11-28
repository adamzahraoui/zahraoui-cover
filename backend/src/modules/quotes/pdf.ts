import PDFDocument from 'pdfkit'
import type { QuoteSnapshot } from './model.js'

const royal = '#1B378A'
const soft = '#6485BC'
const ink = '#233052'

// PDFKit lays out supplied strings as text without interpreting HTML, URLs or filenames.
export function renderQuotePdf(offer: QuoteSnapshot): Promise<Buffer> {
  const agencyName = offer.agency?.agencyName ?? 'Zahraoui Cover'
  const localPhone = (phone: string) => phone.replace(/^(\+212)(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3 $4')
  const pdf = new PDFDocument({
    size: 'A4', margins: { top: 76, bottom: 62, left: 48, right: 48 },
    bufferPages: true, info: { Title: 'Proposition ' + offer.reference, Author: agencyName },
  })
  const output = new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    pdf.on('data', (chunk: Buffer) => chunks.push(chunk))
    pdf.on('end', () => resolve(Buffer.concat(chunks)))
    pdf.on('error', reject)
  })
  const width = pdf.page.width - 96
  const mad = (amount: string) => amount.replace('.', ',') + ' MAD'
  const text = (value: string) => pdf.font('Helvetica').fontSize(10.5).fillColor(ink).text(value, { width, lineGap: 3 })
  function section(title: string, value: string | null) {
    if (!value) return
    if (pdf.y + 72 > pdf.page.maxY()) pdf.addPage()
    pdf.font('Helvetica-Bold').fontSize(13).fillColor(royal).text(title, { width }).moveDown(0.25)
    text(value)
    pdf.moveDown(0.9)
  }

  pdf.font('Helvetica-Bold').fontSize(24).fillColor(royal).text('Proposition d’assurance', { width }).moveDown(0.25)
  pdf.font('Helvetica-Bold').fontSize(11).fillColor(royal).text('DOCUMENT DE DÉVELOPPEMENT - NON VALABLE COMME OFFRE', { width }).moveDown(0.9)
  text(`Référence ${offer.reference}  |  Révision ${offer.revision}`)
  text(`Émission ${offer.issuedOn}  |  Validité jusqu’au ${offer.validUntil} inclus`)
  pdf.moveDown()
  section('Client et assurance', [offer.clientName, offer.city, `Assurance : ${offer.product}`, `Compagnie : ${offer.carrier}`].filter(Boolean).join('\n'))
  section('Tarification annuelle en MAD', `Prime annuelle : ${mad(offer.premium)}\nFrais : ${mad(offer.fees)}\nTaxes : ${mad(offer.taxes)}`)
  pdf.font('Helvetica-Bold').fontSize(14).fillColor(royal).text(`Total : ${mad(offer.total)}`, { width }).moveDown()
  section('Garanties proposées', offer.coverage)
  section('Plafonds et limites', offer.limits)
  section('Franchises', offer.deductibles)
  section('Conditions et exclusions', offer.conditions)
  section('Informations pour le client', offer.customerNotes)
  section('À propos de cette proposition', agencyName + ' intervient comme courtier. Cette proposition ne constitue ni un contrat ni une prise d’effet des garanties.')
  if (offer.agency) section('Coordonnées et références de l’agence',
    [offer.agency.legalName, offer.agency.address, offer.agency.city, offer.agency.email, offer.agency.registration, offer.agency.authorization].filter(Boolean).join('\n'))
  section('Conditions générales de proposition', offer.quoteWording?.body ?? null)

  const pages = pdf.bufferedPageRange()
  for (let index = pages.start; index < pages.start + pages.count; index++) {
    pdf.switchToPage(index)
    const { height, width: pageWidth } = pdf.page
    pdf.rect(0, 0, pageWidth, 52).fill(royal)
    pdf.font('Helvetica-Bold').fontSize(17).fillColor('white').text(agencyName, 48, 17, { lineBreak: false, width: 350, ellipsis: true })
    pdf.font('Helvetica-Bold').fontSize(9).fillColor('white').text('DOCUMENT DE TEST', 427, 21, { lineBreak: false })
    pdf.rect(48, height - 49, width, 1).fill(soft)
    pdf.font('Helvetica').fontSize(8.5).fillColor(royal).text(`APPELEZ-NOUS ${localPhone(offer.agency?.officePhone ?? '+212523281585')}    |    ASSISTANCE ${localPhone(offer.agency?.assistancePhone ?? '+212522542323')}`, 48, height - 39, { lineBreak: false })
    pdf.text(`${index + 1} / ${pages.count}`, pageWidth - 80, height - 39, { lineBreak: false })
  }
  pdf.end()
  return output
}
