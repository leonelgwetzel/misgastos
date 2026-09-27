const plataService = require('./plata.service');
const gastoFijoService = require('./gastoFijo.service');
const ingresoFijoService = require('./ingresoFijo.service');
const { roundMoney } = require('../lib/money');
const {
  MONTH_NAMES,
  WEEKDAY_LABELS,
  currentMonthKey,
  monthKeysInclusive,
  formatMoney,
  buildMonthDayGrid,
} = require('../lib/dates');

function parseYear(value) {
  const now = new Date();
  const year = parseInt(value, 10);
  if (!year || year < 2000 || year > 2100) return now.getFullYear();
  return year;
}

async function getYearCalendar(userId, year) {
  const nowKey = currentMonthKey();
  const keys = monthKeysInclusive(`${year}-01`, `${year}-12`);

  for (const key of keys) {
    if (key >= nowKey) {
      await gastoFijoService.generateForMonth(userId, key);
      await ingresoFijoService.generateForMonth(userId, key);
    }
  }

  const vistas = await Promise.all(
    keys.map((key) => plataService.getVistaPlata(userId, key)),
  );

  const months = keys.map((key, i) => {
    const [, month] = key.split('-').map(Number);
    const vista = vistas[i];
    const fijos = Number(vista.totalEgresosFijos) || 0;
    const tarjetas = Number(vista.pagoTarjetas) || 0;
    const total = roundMoney(fijos + tarjetas);
    const maxHint = Math.max(fijos, tarjetas, 1);

    return {
      key,
      year,
      month,
      label: MONTH_NAMES[month - 1],
      href: `/?year=${year}&month=${month}`,
      isCurrent: key === nowKey,
      isPast: key < nowKey,
      isFuture: key > nowKey,
      fijos,
      tarjetas,
      total,
      fijosFormateado: formatMoney(fijos),
      tarjetasFormateado: formatMoney(tarjetas),
      totalFormateado: formatMoney(total),
      fijosPct: Math.round((fijos / maxHint) * 100),
      tarjetasPct: Math.round((tarjetas / maxHint) * 100),
      days: buildMonthDayGrid(year, month),
    };
  });

  const totalFijos = roundMoney(months.reduce((sum, m) => sum + m.fijos, 0));
  const totalTarjetas = roundMoney(months.reduce((sum, m) => sum + m.tarjetas, 0));
  const total = roundMoney(totalFijos + totalTarjetas);
  const maxMonth = Math.max(...months.map((m) => m.total), 1);

  return {
    year,
    months: months.map((m) => ({
      ...m,
      heatPct: Math.round((m.total / maxMonth) * 100),
    })),
    totalFijos,
    totalTarjetas,
    total,
    totalFijosFormateado: formatMoney(totalFijos),
    totalTarjetasFormateado: formatMoney(totalTarjetas),
    totalFormateado: formatMoney(total),
    weekdays: WEEKDAY_LABELS,
    prevYear: year - 1,
    nextYear: year + 1,
  };
}

module.exports = {
  parseYear,
  getYearCalendar,
};
