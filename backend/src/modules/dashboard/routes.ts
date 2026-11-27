import type { PrismaClient } from '@prisma/client'
import { Router } from 'express'
import { fromProductSlug } from '../business-inputs.js'
import { requestRow, requestRowSelect } from '../quote-requests/admin.js'

export function dashboardRoutes(database: PrismaClient) {
  const routes = Router()
  routes.get('/', async (_request, response) => {
    const [statuses, products, recent, activeClients, openAssistance, unreadMessages, activity, months] = await database.$transaction([
      database.$queryRaw<{ status: string; count: number }[]>`SELECT status, count(*)::int AS count FROM quote_requests GROUP BY status`,
      database.$queryRaw<{ productId: string; count: number }[]>`SELECT product_id AS "productId", count(*)::int AS count FROM quote_requests GROUP BY product_id`,
      database.quoteRequest.findMany({ take: 10, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: requestRowSelect }),
      database.client.count({ where: { archivedAt: null } }),
      database.assistanceCase.count({ where: { status: { not: 'RESOLVED' } } }),
      database.contactMessage.count({ where: { status: 'UNREAD' } }),
      database.auditEvent.findMany({
        where: { targetType: 'quote_request', action: { in: ['QUOTE_REQUEST_RECEIVED','QUOTE_REQUEST_UPDATED','QUOTE_REQUEST_NOTE_ADDED'] } },
        take: 8, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, action: true, targetId: true, createdAt: true },
      }),
      database.$queryRaw<{ month: string; count: number }[]>`
        SELECT to_char(created_at AT TIME ZONE 'Africa/Casablanca', 'YYYY-MM') AS month, count(*)::int AS count
        FROM quote_requests
        WHERE created_at >= (date_trunc('month', now() AT TIME ZONE 'Africa/Casablanca') - interval '5 months') AT TIME ZONE 'Africa/Casablanca'
        GROUP BY 1 ORDER BY 1
      `,
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
        activeClients, openAssistance, unreadMessages,
      },
      recentRequests: recent.map(requestRow),
      byProduct: names.map(row => ({ slug: fromProductSlug(row.slug), title: row.title, count: products.find(product => product.productId === row.id)?.count ?? 0 })),
      activity, months,
    } })
  })
  return routes
}
