import assert from 'node:assert/strict'
import { test } from 'node:test'
import { casablancaDate } from '../src/modules/business-inputs.js'
import { addDays, coverageStatus, onDate } from '../src/modules/contracts/model.js'

test('Casablanca calendar days and exclusive contract boundaries survive offset changes', () => {
  assert.equal(casablancaDate(new Date('2026-02-10T23:30:00Z')), '2026-02-11')
  assert.equal(casablancaDate(new Date('2026-03-03T23:30:00Z')), '2026-03-03')
  assert.equal(casablancaDate(new Date('2026-04-10T23:30:00Z')), '2026-04-11')
  assert.equal(addDays('2028-03-01', -1), '2028-02-29')
  const row = { status: 'ACTIVE' as const, effectiveOn: onDate('2026-02-11'), expiresOn: onDate('2026-04-11'), confirmationOn: onDate('2026-02-10') }
  assert.equal(coverageStatus(row, '2026-02-10'), 'SCHEDULED')
  assert.equal(coverageStatus(row, '2026-02-11'), 'ACTIVE')
  assert.equal(coverageStatus(row, '2026-04-10'), 'ACTIVE')
  assert.equal(coverageStatus(row, '2026-04-11'), 'EXPIRED')
  assert.equal(coverageStatus({ ...row, confirmationOn: null }, '2026-04-10'), 'UNVERIFIED')
})
