const prisma = require('../lib/prisma');
const {
  dateFromMonthKey,
  endOfMonthFromKey,
  formatDbDateInput,
  formatDbMonthInput,
  formatMoney,
  buildChartYAxisTicks,
  monthKeyFromDate,
  MONTH_NAMES,
  sameCalendarMonth,
  shiftCalendarMonth,
} = require('../lib/dates');
const cicloService = require('./cicloFacturacion.service');
const cuotaService = require('./cuota.service');

const PIE_COLORS = ['#6d8f84', '#c4786a', '#8a9eb0', '#c4a082', '#7a8f6d', '#9a7ac4'];

function addSvgPathsToPorTarjeta(porTarjeta) {
  const cx = 50;
  const cy = 50;
  const r = 42;
  let angle = 0;

  return porTarjeta.map((slice) => {
    const sweep = ((slice.endPct - slice.startPct) / 100) * 360;
    const startAngle = angle;
    const endAngle = angle + sweep;
    angle = endAngle;
    return {
      ...slice,
      svgPath: pieSlicePath(cx, cy, r, startAngle, endAngle),
    };
  });
}

function polar(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function pieSlicePath(cx, cy, r, startAngle, endAngle) {
  const sweep = endAngle - startAngle;
  if (sweep <= 0) return '';
  if (sweep >= 359.99) {
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.001} ${cy - r} Z`;
  }
  const start = polar(cx, cy, r, endAngle);
  const end = polar(cx, cy, r, startAngle);
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`;
}

function buildPorTarjeta(porTarjetaMap, totalPrincipal, principalSimbolo = '$') {
  let accPct = 0;
  const porTarjeta = [...porTarjetaMap.values()]
    .filter((t) => t.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((t, i) => {
      const pct = totalPrincipal > 0 ? (t.total / totalPrincipal) * 100 : 0;
      const startPct = accPct;
      accPct += pct;
      return {
        id: t.id,
        alias: t.alias,
        total: t.total,
        totalFormateado: formatMoney(t.total, principalSimbolo),
        pct: Math.round(pct * 10) / 10,
        startPct,
        endPct: accPct,
        color: PIE_COLORS[i % PIE_COLORS.length],
      };
    });

  const pieGradient = porTarjeta.length > 0
    ? porTarjeta.map((t) => `${t.color} ${t.startPct}% ${t.endPct}%`).join(', ')
    : null;

  return {
    porTarjeta: addSvgPathsToPorTarjeta(porTarjeta),
    pieGradient,
  };
}

function scaleProyeccionBars(bars, principalSimbolo = '$') {
  const maxTotal = Math.max(...bars.map((b) => b.total), 0);
  const { yMax, ticks: yAxisTicks } = buildChartYAxisTicks(maxTotal);
  const scaledBars = bars.map((bar) => ({
    ...bar,
    alturaPct: yMax > 0 ? Math.round((bar.total / yMax) * 100) : 0,
  }));

  return {
    bars: scaledBars,
    maxTotal,
    maxTotalFormateado: formatMoney(maxTotal, principalSimbolo),
    yMax,
    yAxisTicks,
  };
}

function sliceProyeccion(proyeccion, monthCount) {
  const bars = proyeccion.bars.slice(0, monthCount);
  const principalSimbolo = proyeccion.divisaPrincipal?.simbolo || '$';
  return {
    ...proyeccion,
    ...scaleProyeccionBars(bars, principalSimbolo),
    monthCount,
  };
}

function buildCuotaItem(cuota, principal) {
  const principalSimbolo = principal?.simbolo || '$';
  const principalCodigo = principal?.codigo || 'ARS';
  const principalId = principal?.id || null;

  return {
    id: cuota.id,
    descripcion: cuota.gasto.descripcion,
    tarjeta: cuota.gasto.tarjeta?.alias || '—',
    categoria: cuota.gasto.categoria?.nombre || 'Sin categoría',
    numero: cuota.numero,
    totalCuotas: cuota.gasto.cantidadCuotas,
    montoOriginal: Number(cuota.montoOriginal),
    montoPrincipal: Number(cuota.montoPrincipal),
    simbolo: cuota.divisa.simbolo,
    codigoDivisa: cuota.divisa.codigo,
    simboloPrincipal: principalSimbolo,
    codigoPrincipal: principalCodigo,
    esDivisaPrincipal: principalId != null && cuota.divisaId === principalId,
    etiqueta: cuota.numero === 0
      ? 'pendiente de facturar'
      : `cuota ${cuota.numero}/${cuota.gasto.cantidadCuotas}`,
  };
}

async function getCompromisosForMonth(userId, monthKey) {
  const mesImpacto = dateFromMonthKey(monthKey);
  const mesFin = endOfMonthFromKey(monthKey);

  const [usuario, tarjetas] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: userId },
      include: { divisaPrincipal: true },
    }),
    prisma.tarjeta.findMany({
      where: { usuarioId: userId, activa: true, titularidad: 'PROPIA' },
      include: {
        divisa: true,
        ciclos: { where: { mesReferencia: mesImpacto } },
      },
      orderBy: { alias: 'asc' },
    }),
  ]);

  const principal = usuario?.divisaPrincipal || null;
  const principalSimbolo = principal?.simbolo || '$';

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
      gasto: { include: { tarjeta: true, categoria: true } },
      divisa: true,
    },
    orderBy: [{ gasto: { tarjetaId: 'asc' } }, { numero: 'asc' }],
  });

  const cuotaCero = [];
  const cuotas = [];
  const porTarjetaMap = new Map();
  let totalPrincipal = 0;

  function addPorTarjeta(tarjetaId, alias, montoPrincipal) {
    if (!tarjetaId) return;
    const current = porTarjetaMap.get(tarjetaId) || {
      id: tarjetaId,
      alias: alias || '—',
      total: 0,
    };
    current.total += montoPrincipal;
    porTarjetaMap.set(tarjetaId, current);
  }

  for (const cuota of cuotasDb) {
    const tarjetaId = cuota.gasto.tarjetaId;
    const item = buildCuotaItem(cuota, principal);

    if (cuota.numero === 0) {
      if (!tarjetaId) continue;
      const purchaseKey = monthKeyFromDate(cuota.mesImpacto);
      const cicloCompra = await cicloForTarjetaMonth(tarjetaId, purchaseKey);
      if (cuotaService.shouldShowCuotaCero(cuota, cicloCompra.fechaCierre)) {
        cuotaCero.push(item);
        totalPrincipal += item.montoPrincipal;
        addPorTarjeta(tarjetaId, item.tarjeta, item.montoPrincipal);
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
    addPorTarjeta(tarjetaId, item.tarjeta, item.montoPrincipal);
  }

  const { porTarjeta, pieGradient } = buildPorTarjeta(porTarjetaMap, totalPrincipal, principalSimbolo);

  const culminadosItems = cuotas.filter(
    (c) => c.totalCuotas > 1 && c.numero === c.totalCuotas,
  );
  const culminadosTotal = culminadosItems.reduce((sum, c) => sum + c.montoPrincipal, 0);

  return {
    tarjetas: tarjetasConCiclo,
    cuotaCero,
    cuotas,
    porTarjeta,
    pieGradient,
    divisaPrincipal: principal
      ? { codigo: principal.codigo, simbolo: principal.simbolo }
      : { codigo: 'ARS', simbolo: '$' },
    totalPrincipal,
    totalFormateado: formatMoney(totalPrincipal, principalSimbolo),
    culminados: {
      count: culminadosItems.length,
      totalPrincipal: culminadosTotal,
      totalFormateado: formatMoney(culminadosTotal, principalSimbolo),
      items: culminadosItems,
    },
    monthKey,
    mensaje: tarjetasConCiclo.length === 0
      ? 'Agregá una tarjeta para ver compromisos.'
      : null,
  };
}

async function getProyeccionTarjetas(userId, baseMonthKey, monthCount = 12) {
  const [baseYear, baseMonth] = baseMonthKey.split('-').map(Number);
  const bars = [];
  let divisaPrincipal = null;

  let year = baseYear;
  let month = baseMonth;

  for (let i = 0; i < monthCount; i += 1) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const vista = await getCompromisosForMonth(userId, key);
    if (!divisaPrincipal) divisaPrincipal = vista.divisaPrincipal;

    bars.push({
      key,
      shortLabel: MONTH_NAMES[month - 1].slice(0, 3),
      total: vista.totalPrincipal,
      totalFormateado: formatMoney(vista.totalPrincipal, vista.divisaPrincipal.simbolo),
      esActual: key === baseMonthKey,
    });

    const next = shiftCalendarMonth(year, month, 1);
    year = next.year;
    month = next.month;
  }

  const principalSimbolo = divisaPrincipal?.simbolo || '$';

  return {
    baseMonthKey,
    monthCount,
    divisaPrincipal,
    ...scaleProyeccionBars(bars, principalSimbolo),
  };
}

async function getProyeccionTarjetas12Meses(userId, baseMonthKey) {
  return getProyeccionTarjetas(userId, baseMonthKey, 12);
}

module.exports = {
  getCompromisosForMonth,
  getProyeccionTarjetas,
  getProyeccionTarjetas12Meses,
  sliceProyeccion,
};
