import type { Audience, ProductSlug } from '@prisma/client'
import { connectPrisma } from '../src/database/prisma.js'

const categories: { slug: ProductSlug; title: string; audiences: Audience[] }[] = [
  { slug: 'automobile', title: 'Assurance automobile', audiences: ['INDIVIDUAL', 'BUSINESS'] },
  { slug: 'habitation', title: 'Assurance habitation', audiences: ['INDIVIDUAL'] },
  { slug: 'sante', title: 'Assurance santé', audiences: ['INDIVIDUAL', 'BUSINESS'] },
  { slug: 'voyage', title: 'Assurance voyage', audiences: ['INDIVIDUAL', 'BUSINESS'] },
  { slug: 'professionnelle', title: 'Assurance professionnelle', audiences: ['BUSINESS'] },
  { slug: 'responsabilite_civile', title: 'Responsabilité civile', audiences: ['INDIVIDUAL', 'BUSINESS'] },
]

async function seed() {
  if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
    throw new Error('Development/test only')
  }
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL required')
  const url = new URL(databaseUrl)
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Local database required')
  const database = connectPrisma(databaseUrl)
  try {
    await database.$transaction(categories.map((category, displayOrder) => database.insuranceProduct.upsert({
      where: { slug: category.slug },
      update: {},
      create: {
        ...category,
        summary: 'Catégorie de démonstration. Le contenu définitif reste à valider.',
        displayOrder,
        potentialCoverages: [],
        eligibilityText: '',
        documentHints: [],
        faqs: [],
        relatedSlugs: [],
      },
    })))
    console.info('Six catégories de référence disponibles, non publiées à la création.')
  } finally {
    await database.$disconnect()
  }
}

seed().catch(() => {
  console.error('Insertion impossible. Vérifiez la base locale et les migrations.')
  process.exitCode = 1
})
