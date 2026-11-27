import type { PrismaClient } from '@prisma/client'
import { Router } from 'express'
import { casablancaDate, fromProductSlug } from '../business-inputs.js'
import { addDays, contractRow, contractRowSelect, dateOnly, onDate } from '../contracts/model.js'
import { quoteRow, quoteRowSelect } from '../quotes/model.js'
import { requestRow, requestRowSelect } from '../quote-requests/admin.js'

export function dashboardRoutes(database: PrismaClient) {
  const routes = Router()
  routes.get('/', async (_request, response) => {
    const today = onDate(casablancaDate())
    const horizon = onDate(addDays(dateOnly(today), 30))
    const [policyMetrics, recentContracts, quoteMetrics, issuedQuotes, statuses, products, recent, activeClients, openAssistance, unreadMessages, activity, months, totalClients, provisionalClients, newAssistance, inReviewAssistance] = await database.$transaction([
      database.$queryRaw<{ total: number; active: number; draft: number; scheduled: number; expiring: number; expired: number; attention: number }[]>`
        SELECT
          count(*)::int AS total,
          count(*) FILTER (WHERE status='ACTIVE' AND confirmation_on IS NOT NULL AND effective_on <= ${today}::date AND expires_on > ${today}::date)::int AS active,
          count(*) FILTER (WHERE status='DRAFT')::int AS draft,
          count(*) FILTER (WHERE status='ACTIVE' AND confirmation_on IS NOT NULL AND effective_on > ${today}::date AND expires_on > ${today}::date)::int AS scheduled,
          count(*) FILTER (WHERE status='ACTIVE' AND confirmation_on IS NOT NULL AND effective_on <= ${today}::date
            AND expires_on > ${today}::date AND expires_on <= ${horizon}::date)::int AS expiring,
          count(*) FILTER (WHERE status='EXPIRED' OR (status='ACTIVE' AND expires_on <= ${today}::date))::int AS expired,
          count(*) FILTER (WHERE status IN ('ACTIVE','EXPIRED') AND confirmation_on IS NOT NULL AND expires_on <= ${horizon}::date
            AND NOT EXISTS (SELECT 1 FROM contracts successor WHERE successor.previous_id=policy.id AND successor.activated_at IS NOT NULL))::int AS attention
        FROM contracts policy
      `,
      database.contract.findMany({ select: contractRowSelect, take: 8, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }] }),
      database.$queryRaw<{ status: string; count: number }[]>`
        SELECT CASE WHEN status IN ('ISSUED','SENT') AND valid_until < ${today}::date THEN 'EXPIRED' ELSE status::text END AS status,
          count(*)::int AS count FROM quotes GROUP BY 1
      `,
      database.quote.findMany({ where: { issuedAt: { not: null } }, select: quoteRowSelect,
        take: 8, orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }] }),
      database.$queryRaw<{ status: string; count: number }[]>`SELECT status, count(*)::int AS count FROM quote_requests GROUP BY status`,
      database.$queryRaw<{ productId: string; count: number }[]>`SELECT product_id AS "productId", count(*)::int AS count FROM quote_requests GROUP BY product_id`,
      database.quoteRequest.findMany({ take: 10, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: requestRowSelect }),
      database.client.count({ where: { archivedAt: null } }),
      database.assistanceCase.count({ where: { status: { not: 'RESOLVED' } } }),
      database.contactMessage.count({ where: { status: 'UNREAD' } }),
      database.auditEvent.findMany({
        where: { targetType: { in: ['quote_request', 'client', 'contact_message', 'assistance_case', 'quote', 'contract'] }, action: { not: 'RECORD_VIEWED' } },
        take: 8, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, action: true, targetType: true, targetId: true, createdAt: true },
      }),
      database.$queryRaw<{ month: string; count: number }[]>`
        SELECT to_char(created_at AT TIME ZONE 'Africa/Casablanca', 'YYYY-MM') AS month, count(*)::int AS count
        FROM quote_requests
        WHERE created_at >= (date_trunc('month', now() AT TIME ZONE 'Africa/Casablanca') - interval '5 months') AT TIME ZONE 'Africa/Casablanca'
        GROUP BY 1 ORDER BY 1
      `,
      database.client.count(),
      database.client.count({ where: { archivedAt: null, intakeProvisional: true } }),
      database.assistanceCase.count({ where: { status: 'NEW' } }),
      database.assistanceCase.count({ where: { status: 'IN_PROGRESS' } }),
    ], { isolationLevel: 'RepeatableRead' })
    const names = await database.insuranceProduct.findMany({
      where: { id: { in: products.map(product => product.productId) } }, select: { id: true, slug: true, title: true },
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    })
    const count = (status: string) => statuses.find(row => row.status === status)?.count ?? 0
    response.json({ data: {
      counts: {
        newRequests: count('NEW'), inReviewRequests: count('IN_REVIEW'),
        openRequests: count('NEW') + count('IN_REVIEW') + count('QUOTE_SENT'),
        totalRequests: statuses.reduce((sum, row) => sum + row.count, 0),
        activeClients, openAssistance, unreadMessages, totalClients, provisionalClients, newAssistance, inReviewAssistance,
      },
      recentRequests: recent.map(requestRow),
      recentQuotes: issuedQuotes.map(quoteRow),
      contractCounts: policyMetrics[0], recentContracts: recentContracts.map(contractRow),
      quoteCounts: Object.fromEntries(quoteMetrics.map(({ status, count }) => [status, count])),
      byProduct: names.map(row => ({ slug: fromProductSlug(row.slug), title: row.title, count: products.find(product => product.productId === row.id)?.count ?? 0 })),
      activity, months,
    } })
  })
  return routes
}
