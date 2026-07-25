/**
 * Utilities for consistent date parsing and ranges in Colombia Timezone (America/Bogota, UTC-5).
 */

export const COLOMBIA_OFFSET = '-05:00'

/**
 * Parses a date or date range in Colombia local time (UTC-5).
 * @param {string|null} startDateParam - YYYY-MM-DD or ISO string
 * @param {string|null} endDateParam - YYYY-MM-DD or ISO string
 * @returns {{ start: Date, end: Date }}
 */
export function getColombiaDateRange(startDateParam, endDateParam) {
  const nowInColombia = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }))
  const todayYmd = [
    nowInColombia.getFullYear(),
    String(nowInColombia.getMonth() + 1).padStart(2, '0'),
    String(nowInColombia.getDate()).padStart(2, '0')
  ].join('-')

  let start
  if (startDateParam && /^\d{4}-\d{2}-\d{2}$/.test(startDateParam)) {
    start = new Date(`${startDateParam}T00:00:00.000${COLOMBIA_OFFSET}`)
  } else if (startDateParam) {
    start = new Date(startDateParam)
  } else {
    start = new Date(`${todayYmd}T00:00:00.000${COLOMBIA_OFFSET}`)
  }

  let end
  if (endDateParam && /^\d{4}-\d{2}-\d{2}$/.test(endDateParam)) {
    end = new Date(`${endDateParam}T23:59:59.999${COLOMBIA_OFFSET}`)
  } else if (endDateParam) {
    end = new Date(endDateParam)
    end.setHours(23, 59, 59, 999)
  } else {
    end = new Date(`${todayYmd}T23:59:59.999${COLOMBIA_OFFSET}`)
  }

  return { start, end }
}

/**
 * Returns today's date in YYYY-MM-DD in Colombia Timezone.
 */
export function getColombiaTodayYMD() {
  const nowInColombia = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }))
  return [
    nowInColombia.getFullYear(),
    String(nowInColombia.getMonth() + 1).padStart(2, '0'),
    String(nowInColombia.getDate()).padStart(2, '0')
  ].join('-')
}
