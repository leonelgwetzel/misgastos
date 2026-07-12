const prisma = require('../lib/prisma');
const {
  dateFromMonthKey,
  endOfMonthFromKey,
  formatDbDateInput,
  formatDbMonthInput,
  formatMoney,
  monthKeyFromDate,
  MONTH_NAMES,
  sameCalendarMonth,
  shiftCalendarMonth,
} = require('../lib/dates');
const cicloService = require('./cicloFacturacion.service');
const cuotaService = require('./cuota.service');

async function getCompromisosForMonth(userId, monthKey) {
  const mesImpacto = dateFromMonthKey(monthKey);
  const mesFin = endOfMonthFromKey(monthKey);

  const tarjetas = await prisma.tarjeta.findMany({
    where: { usuarioId: userId, activa: true, titularidad: 'PROPIA' },
    include: {
      divisa: true,
      ciclos: { where: { mesReferencia: mesImpacto } },
    },
    orderBy: { alias: 'asc' },
  });

  const tarjetaPorId = Object.fromEntries(tarjetas.map((t) => [t.id, t]));
  const cicloCache = new Map();

  async function cicloForTarjetaMonth(tarjetaId, key) {
    const cacheKey = `${tarjetaId}:${key}`;
    if (cicloCache.has(cacheKey)) return cicloCache.get(cacheKey);

    const tarjeta = tarjetaPorId[tarjetaId];
    const ciclo = await cicloService.getOrCreateCiclo(tarjeta, key);
    cicloCache.set(cacheKey, ciclo);
    return ciclo;
  }

  const tarjetasConCiclo = await Promise.all(
    tarjetas.map(async (t) => {
      const ciclo = t.ciclos[0] || await cicloService.getOrCreateCiclo(t, monthKey);
      cicloCache.set(`${t.id}:${monthKey}`, ciclo);
      return {
        id: t.id,
        alias: t.alias,
        divisa: t.divisa.codigo,
        simbolo: t.divisa.simbolo,
        ciclo,
        cicloForm: {
          fechaCierre: formatDbDateInput(ciclo.fechaCierre),
          mesVencimiento: formatDbMonthInput(ciclo.mesVencimiento),
        },
      };
    }),
  );

  const cuotasDb = await prisma.cuota.findMany({
    where: {
      gasto: { usuarioId: userId, medioPago: 'TARJETA' },
      mesImpacto: { gte: mesImpacto, lte: mesFin },
    },
    include: {
      gasto: { include: { tarjeta: true } },
      divisa: true,
    },
    orderBy: [{ gasto: { tarjetaId: 'asc' } }, { numero: 'asc' }],
  });

  const cuotaCero = [];
  const cuotas = [];
  let totalPrincipal = 0;

  for (const cuota of cuotasDb) {
    const tarjetaId = cuota.gasto.tarjetaId;
    const item = {
      id: cuota.id,
      descripcion: cuota.gasto.descripcion,
      tarjeta: cuota.gasto.tarjeta?.alias || '—',
      numero: cuota.numero,
      totalCuotas: cuota.gasto.cantidadCuotas,
      montoOriginal: Number(cuota.montoOriginal),
      montoPrincipal: Number(cuota.montoPrincipal),
      simbolo: cuota.divisa.simbolo,
      etiqueta: cuota.numero === 0
        ? 'pendiente de facturar'
        : `cuota ${cuota.numero}/${cuota.gasto.cantidadCuotas}`,
    };

    if (cuota.numero === 0) {
      if (!tarjetaId) continue;
      const purchaseKey = monthKeyFromDate(cuota.mesImpacto);
      const cicloCompra = await cicloForTarjetaMonth(tarjetaId, purchaseKey);
      if (cuotaService.shouldShowCuotaCero(cuota, cicloCompra.fechaCierre)) {
        cuotaCero.push(item);
        totalPrincipal += item.montoPrincipal;
      }
      continue;
    }

    if (cuota.estado === 'PAGADA') continue;

    const cuota0 = cuotasDb.find(
      (c) => c.gastoId === cuota.gastoId && c.numero === 0,
    );
    if (cuota.numero === 1 && cuota0 && sameCalendarMonth(cuota0.mesImpacto, cuota.mesImpacto)) {
      const purchaseKey = monthKeyFromDate(cuota0.mesImpacto);
      const cicloCompra = tarjetaId
        ? await cicloForTarjetaMonth(tarjetaId, purchaseKey)
        : null;
      if (
        cicloCompra
        && cuotaService.shouldShowCuotaCero(cuota0, cicloCompra.fechaCierre)
      ) {
        continue;
      }
    }

    cuotas.push(item);
    totalPrincipal += item.montoPrincipal;
  }

  return {
    tarjetas: tarjetasConCiclo,
    cuotaCero,
    cuotas,
    totalPrincipal,
    totalFormateado: formatMoney(totalPrincipal),
    monthKey,
    mensaje: tarjetasConCiclo.length === 0
      ? 'Agregá una tarjeta para ver compromisos.'
      : null,
  };
}

async function getProyeccionTarjetas12Meses(userId, baseMonthKey) {
  const [baseYear, baseMonth] = baseMonthKey.split('-').map(Number);
  const bars = [];
  let maxTotal = 0;

  let year = baseYear;
  let month = baseMonth;

  for (let i = 0; i < 12; i += 1) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const vista = await getCompromisosForMonth(userId, key);
    const total = vista.totalPrincipal;
    if (total > maxTotal) maxTotal = total;

    bars.push({
      key,
      shortLabel: MONTH_NAMES[month - 1].slice(0, 3),
      total,
      totalFormateado: formatMoney(total),
      esActual: key === baseMonthKey,
    });

    const next = shiftCalendarMonth(year, month, 1);
    year = next.year;
    month = next.month;
  }

  for (const bar of bars) {
    bar.alturaPct = maxTotal > 0 ? Math.round((bar.total / maxTotal) * 100) : 0;
  }

  return {
    bars,
    maxTotal,
    maxTotalFormateado: formatMoney(maxTotal),
    baseMonthKey,
  };
}

module.exports = {
  getCompromisosForMonth,
  getProyeccionTarjetas12Meses,
};
