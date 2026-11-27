import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Prisma } from '@prisma/client'
import { calculateTotal, quoteInput } from '../src/modules/quotes/model.js'

test('currency totals use decimal arithmetic and fit the database precision', () => {
  const d = (value: string) => new Prisma.Decimal(value)
  assert.equal(calculateTotal(d('0.10'), d('0.20'), d('0.01')).toFixed(2), '0.31')
  assert.equal(calculateTotal(d('9999999999.98'), d('0.01'), d('0')).toFixed(2), '9999999999.99')
  assert.throws(() => calculateTotal(d('9999999999.98'), d('0.02'), d('0')))
  const amount = quoteInput.shape.annualPremiumMad
  for (const input of [0.03, '1e3', '1.001', '-0.10', '0', '10000000000.00']) assert.equal(amount.safeParse(input).success, false)
})
