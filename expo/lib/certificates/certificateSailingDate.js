const MONTHS = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year, month) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function formatValidatedDate(year, month, day) {
  if (!Number.isInteger(year) || year < 2000 || year > 2199) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(day) || day < 1 || day > daysInMonth(year, month)) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Converts Royal certificate dates without relying on implementation-defined
 * JavaScript Date string parsing. Hermes does not consistently accept strings
 * such as "August 13, 2026", even though desktop JavaScript engines do.
 */
function normalizeCertificateSailingDate(value) {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!normalized) return null;

  const numeric = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (numeric) {
    const year = Number.parseInt(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3], 10);
    return formatValidatedDate(year, Number.parseInt(numeric[1], 10), Number.parseInt(numeric[2], 10));
  }

  const textual = normalized.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (!textual) return null;
  const month = MONTHS[textual[1].toLowerCase()];
  if (!month) return null;
  return formatValidatedDate(Number.parseInt(textual[3], 10), month, Number.parseInt(textual[2], 10));
}

module.exports = { normalizeCertificateSailingDate };
