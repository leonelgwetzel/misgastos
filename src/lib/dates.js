const { isAfter } = require('date-fns');

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Fecha calendario en UTC (alineada con columnas @db.Date de Prisma). */
function utcDate(year, month, day = 1) {
  return new Date(Date.UTC(year, month - 1, day));
}

/** Interpreta un valor @db.Date como fecha calendario sin corrimiento de zona. */
function fromDbDate(date) {
  if (!date) return null;
  return utcDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function monthKeyFromDbDate(date) {
  const d = fromDbDate(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function parseMonthParams(query) {
  const now = new Date();
  let year = parseInt(query.year, 10);
  let month = parseInt(query.month, 10);

  if (!year || year < 2000 || year > 2100) year = now.getFullYear();
  if (!month || month < 1 || month > 12) month = now.getMonth() + 1;

  return {
    year,
    month,
    date: utcDate(year, month, 1),
    label: `${MONTH_NAMES[month - 1]} ${year}`,
    key: `${year}-${String(month).padStart(2, '0')}`,
  };
}

function shiftCalendarMonth(year, month, delta) {
  let y = year;
  let m = month + delta;
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  return { year: y, month: m };
}

function monthNavUrls(year, month, tab = 'compromisos') {
  const base = (y, m) => `/?year=${y}&month=${m}&tab=${tab}`;
  const prev = shiftCalendarMonth(year, month, -1);
  const next = shiftCalendarMonth(year, month, 1);

  return {
    prev: base(prev.year, prev.month),
    next: base(next.year, next.month),
    current: base(year, month),
  };
}

function formatMoney(amount, symbol = '$') {
  const num = Number(amount);
  if (Number.isNaN(num)) return `${symbol} 0`;
  return `${symbol} ${num.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function monthKeyFromDate(date) {
  return monthKeyFromDbDate(date);
}

function dateFromMonthKey(key) {
  const [y, m] = key.split('-').map(Number);
  return utcDate(y, m, 1);
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function endOfMonthFromKey(key) {
  const [y, m] = key.split('-').map(Number);
  return utcDate(y, m, daysInMonth(y, m));
}

function addCalendarMonths(year, month, delta) {
  return shiftCalendarMonth(year, month, delta);
}

function addCalendarMonthsFromDbDate(date, delta) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const shifted = shiftCalendarMonth(y, m, delta);
  return utcDate(shifted.year, shifted.month, 1);
}

function parseInputDate(value) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return utcDate(y, m, d);
}

function buildDefaultCicloDates(year, month, cierreDia, vencimientoOffsetMeses = 1) {
  const mesRef = utcDate(year, month, 1);
  const day = Math.min(cierreDia, daysInMonth(year, month));
  const fechaCierre = utcDate(year, month, day);
  const venc = shiftCalendarMonth(year, month, vencimientoOffsetMeses);
  const mesVencimiento = utcDate(venc.year, venc.month, 1);
  return { mesReferencia: mesRef, fechaCierre, mesVencimiento };
}

function isCycleOpen(fechaCierre, referenceDate = new Date()) {
  const cierreDay = fromDbDate(fechaCierre);
  const ref = utcDate(
    referenceDate.getFullYear(),
    referenceDate.getMonth() + 1,
    referenceDate.getDate(),
  );
  return !isAfter(ref, cierreDay);
}

function sameCalendarMonth(a, b) {
  return monthKeyFromDbDate(a) === monthKeyFromDbDate(b);
}

function formatDbDateInput(date) {
  const d = fromDbDate(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDbMonthInput(date) {
  const d = fromDbDate(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

module.exports = {
  parseMonthParams,
  shiftCalendarMonth,
  addCalendarMonths,
  addCalendarMonthsFromDbDate,
  daysInMonth,
  monthNavUrls,
  formatMoney,
  capitalize,
  MONTH_NAMES,
  utcDate,
  fromDbDate,
  monthKeyFromDate,
  monthKeyFromDbDate,
  dateFromMonthKey,
  endOfMonthFromKey,
  parseInputDate,
  buildDefaultCicloDates,
  isCycleOpen,
  sameCalendarMonth,
  formatDbDateInput,
  formatDbMonthInput,
};
