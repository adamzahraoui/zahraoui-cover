import { PrismaClient } from '@prisma/client'

export function connectPrisma(databaseUrl: string) {
  return new PrismaClient({ datasourceUrl: databaseUrl, errorFormat: 'minimal' })
}
