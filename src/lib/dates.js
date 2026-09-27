const { isAfter } = require('date-fns');

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Fecha calendario en UTC (alineada con columnas @db.Date de Prisma). */
function utcDate(year, month, day = 1) {
  return new Date(Date.UTC(year, month - 1, day));
}

function utcToday() {
  const now = new Date();
  return utcDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthKeysInclusive(fromKey, toKey) {
  if (!fromKey || !toKey || fromKey > toKey) return [];
  const keys = [];
  let [year, month] = fromKey.split('-').map(Number);
  const [endYear, endMonth] = toKey.split('-').map(Number);
  while (year < endYear || (year === endYear && month <= endMonth)) {
    keys.push(`${year}-${String(month).padStart(2, '0')}`);
    const next = shiftCalendarMonth(year, month, 1);
    year = next.year;
    month = next.month;
  }
  return keys;
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

function monthNavUrls(year, month, tab) {
  const base = (y, m) => {
    let url = `/?year=${y}&month=${m}`;
    // tab se ignora en la vista unificada; se acepta por compatibilidad de callers
    if (tab) url += `&tab=${tab}`;
    return url;
  };
  const prev = shiftCalendarMonth(year, month, -1);
  const next = shiftCalendarMonth(year, month, 1);
  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth() + 1;

  return {
    prev: base(prev.year, prev.month),
    next: base(next.year, next.month),
    current: base(year, month),
    today: base(todayYear, todayMonth),
    isCurrentMonth: year === todayYear && month === todayMonth,
  };
}

function formatMoney(amount, symbol = '$') {
  const num = Number(amount);
  if (Number.isNaN(num)) return `${symbol} 0`;
  return `${symbol} ${num.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatMoneyCompact(amount, symbol = '$') {
  const num = Number(amount);
  if (Number.isNaN(num) || num === 0) return `${symbol} 0`;
  if (num >= 1_000_000) {
    return `${symbol} ${(num / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })}M`;
  }
  if (num >= 1_000) {
    return `${symbol} ${Math.round(num / 1_000).toLocaleString('es-AR')}k`;
  }
  return formatMoney(num, symbol);
}

function buildChartYAxisTicks(maxValue, tickCount = 4) {
  if (maxValue <= 0) {
    return { yMax: 0, ticks: [{ value: 0, label: formatMoneyCompact(0) }] };
  }

  const rawStep = maxValue / tickCount;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = Math.ceil(rawStep / magnitude) * magnitude;
  const yMax = Math.ceil(maxValue / step) * step;
  const ticks = [];

  for (let value = 0; value <= yMax; value += step) {
    ticks.push({ value, label: formatMoneyCompact(value) });
  }

  return { yMax, ticks };
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

const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function buildMonthDayGrid(year, month) {
  const first = utcDate(year, month, 1);
  const sundayIndex = first.getUTCDay();
  const mondayPad = sundayIndex === 0 ? 6 : sundayIndex - 1;
  const lastDay = daysInMonth(year, month);
  const today = utcToday();
  const cells = [];

  for (let i = 0; i < mondayPad; i += 1) {
    cells.push({ day: null, isToday: false });
  }
  for (let day = 1; day <= lastDay; day += 1) {
    cells.push({
      day,
      isToday:
        today.getUTCFullYear() === year
        && today.getUTCMonth() + 1 === month
        && today.getUTCDate() === day,
    });
  }
  while (cells.length < 42) {
    cells.push({ day: null, isToday: false });
  }

  return cells;
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
  formatMoneyCompact,
  buildChartYAxisTicks,
  capitalize,
  MONTH_NAMES,
  WEEKDAY_LABELS,
  buildMonthDayGrid,
  utcDate,
  utcToday,
  currentMonthKey,
  monthKeysInclusive,
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
