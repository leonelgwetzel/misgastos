const prisma = require('../lib/prisma');
const { roundMoney } = require('../lib/money');
const {
  dateFromMonthKey,
  endOfMonthFromKey,
  formatMoney,
  shiftCalendarMonth,
  currentMonthKey,
  monthKeysInclusive,
  MONTH_NAMES,
} = require('../lib/dates');
const cuentaService = require('./cuenta.service');
const divisaService = require('./divisa.service');
const proyeccionService = require('./proyeccion.service');
const ingresoFijoService = require('./ingresoFijo.service');
const gastoFijoService = require('./gastoFijo.service');
const categoriaService = require('./categoria.service');
const { resolverEstilo } = require('../lib/categoriaEstilo');

function buildCategoryPie(items, estilos = new Map()) {
  const map = new Map();
  for (const item of items) {
    const name = item.categoria || 'Sin categoría';
    map.set(name, (map.get(name) || 0) + Number(item.montoPrincipal || 0));
  }

  const total = [...map.values()].reduce((s, v) => s + v, 0);
  let accPct = 0;
  const slices = [...map.entries()]
    .map(([nombre, monto]) => ({ nombre, monto: roundMoney(monto) }))
    .filter((s) => s.monto > 0)
    .sort((a, b) => b.monto - a.monto)
    .map((s) => {
      const pct = total > 0 ? (s.monto / total) * 100 : 0;
      const startPct = accPct;
      accPct += pct;
      const estilo = estilos.get(s.nombre) || resolverEstilo({ nombre: s.nombre });
      return {
        alias: s.nombre,
        nombre: s.nombre,
        total: s.monto,
        totalFormateado: formatMoney(s.monto),
        pct: Math.round(pct * 10) / 10,
        startPct,
        endPct: accPct,
        color: estilo.color,
        icon: estilo.icono,
      };
    });

  const maxMonto = slices.length > 0 ? slices[0].total : 0;
  for (const slice of slices) {
    slice.pctDelMayor = maxMonto > 0 ? Math.round((slice.total / maxMonto) * 1000) / 10 : 0;
  }

  const withPaths = addSvgPaths(slices);
  withPaths.total = total;
  withPaths.totalFormateado = formatMoney(total);
  return withPaths;
}

function addSvgPaths(slices) {
  const cx = 70;
  const cy = 70;
  const outerR = 44;
  const innerR = 33;
  const gapDeg = slices.length > 1 ? 3.2 : 0;
  let angle = -90;

  function polar(r, a) {
    const rad = (a * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  return slices.map((slice, index) => {
    const rawSweep = ((slice.endPct - slice.startPct) / 100) * 360;
    const sweep = Math.max(rawSweep - gapDeg, 0.4);
    const startA = angle + gapDeg / 2;
    const endA = startA + sweep;
    const midA = startA + sweep / 2;
    angle += rawSweep;

    const os = polar(outerR, startA);
    const oe = polar(outerR, endA);
    const ie = polar(innerR, endA);
    const is = polar(innerR, startA);
    const large = sweep > 180 ? 1 : 0;

    const svgPath = slices.length === 1
      ? [
        `M ${cx} ${cy - outerR}`,
        `A ${outerR} ${outerR} 0 1 1 ${cx} ${cy + outerR}`,
        `A ${outerR} ${outerR} 0 1 1 ${cx} ${cy - outerR}`,
        `M ${cx} ${cy - innerR}`,
        `A ${innerR} ${innerR} 0 1 0 ${cx} ${cy + innerR}`,
        `A ${innerR} ${innerR} 0 1 0 ${cx} ${cy - innerR}`,
      ].join(' ')
      : [
        `M ${os.x.toFixed(2)} ${os.y.toFixed(2)}`,
        `A ${outerR} ${outerR} 0 ${large} 1 ${oe.x.toFixed(2)} ${oe.y.toFixed(2)}`,
        `L ${ie.x.toFixed(2)} ${ie.y.toFixed(2)}`,
        `A ${innerR} ${innerR} 0 ${large} 0 ${is.x.toFixed(2)} ${is.y.toFixed(2)}`,
        'Z',
      ].join(' ');

    const callout = polar(56, midA);

    return {
      ...slice,
      svgPath,
      calloutX: (callout.x / 140) * 100,
      calloutY: (callout.y / 140) * 100,
      showCallout: slices.length <= 5 || (index < 4 && slice.pct >= 8),
    };
  });
}

async function getVistaPlata(userId, monthKey) {
  const mesInicio = dateFromMonthKey(monthKey);
  const mesFin = endOfMonthFromKey(monthKey);

  const [movimientos, cuentas, gastosFijosMes] = await Promise.all([
    prisma.movimiento.findMany({
      where: {
        usuarioId: userId,
        fecha: { gte: mesInicio, lte: mesFin },
        tipo: { in: ['INGRESO', 'EGRESO'] },
      },
      include: {
        divisa: true,
        cuenta: true,
        categoria: true,
        gasto: { select: { gastoFijoId: true, categoriaId: true } },
        ingresoFijo: { select: { id: true } },
      },
      orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.cuenta.findMany({
      where: { usuarioId: userId, activa: true },
      include: { divisa: true },
    }),
    prisma.gasto.findMany({
      where: {
        usuarioId: userId,
        mesGenerado: { gte: mesInicio, lte: mesFin },
        medioPago: { in: ['EFECTIVO', 'DEBITO'] },
      },
      include: { divisa: true, cuenta: true, categoria: true },
      orderBy: [{ fechaCompra: 'asc' }],
    }),
  ]);

  const ingresos = [];
  const egresos = [];
  let totalIngresos = 0;
  let totalEgresos = 0;
  let totalEgresosFijos = 0;

  for (const mov of movimientos) {
    const item = {
      id: mov.id,
      descripcion: mov.descripcion || (mov.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'),
      cuenta: mov.cuenta.nombre,
      monto: Number(mov.monto),
      montoPrincipal: Number(mov.montoPrincipal),
      simbolo: mov.divisa.simbolo,
      fecha: mov.fecha,
      categoria: mov.categoria?.nombre || 'Sin categoría',
    };

    if (mov.tipo === 'INGRESO') {
      if (mov.ingresoFijoId) item.esFijo = true;
      ingresos.push(item);
      totalIngresos += item.montoPrincipal;
    } else {
      if (mov.gasto?.gastoFijoId) {
        item.esFijo = true;
        totalEgresosFijos += item.montoPrincipal;
      }
      egresos.push(item);
      totalEgresos += item.montoPrincipal;
    }
  }

  const movimientoGastoIds = new Set(
    movimientos.filter((m) => m.gastoId).map((m) => m.gastoId),
  );

  for (const gasto of gastosFijosMes) {
    if (movimientoGastoIds.has(gasto.id)) continue;

    const item = {
      id: gasto.id,
      descripcion: gasto.descripcion,
      cuenta: gasto.cuenta?.nombre || 'Sin cuenta',
      monto: Number(gasto.montoOriginal),
      montoPrincipal: Number(gasto.montoPrincipal),
      simbolo: gasto.divisa.simbolo,
      fecha: gasto.fechaCompra,
      esFijo: true,
      categoria: gasto.categoria?.nombre || 'Sin categoría',
    };
    egresos.push(item);
    totalEgresos += item.montoPrincipal;
    totalEgresosFijos += item.montoPrincipal;
  }

  const [ingresosProyectados, egresosProyectados] = await Promise.all([
    ingresoFijoService.previewPendingForMonth(userId, monthKey),
    gastoFijoService.previewPendingCashForMonth(userId, monthKey),
  ]);
  for (const item of ingresosProyectados) {
    ingresos.push(item);
    totalIngresos += item.montoPrincipal;
  }
  for (const item of egresosProyectados) {
    egresos.push(item);
    totalEgresos += item.montoPrincipal;
    totalEgresosFijos += item.montoPrincipal;
  }

  ingresos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  egresos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  const compromisos = await proyeccionService.getCompromisosForMonth(userId, monthKey);
  const pagoTarjetas = roundMoney(compromisos.totalPrincipal);
  const totalEgresosConTarjetas = roundMoney(totalEgresos + pagoTarjetas);
  totalEgresosFijos = roundMoney(totalEgresosFijos);

  const saldoCuentas = await saldoAcumuladoAlMes(userId, cuentas, monthKey);

  const resultado = roundMoney(totalIngresos - totalEgresosConTarjetas);

  const estilosCategoria = await categoriaService.estiloPorNombre(userId);
  decorarMovimientos(ingresos, estilosCategoria);
  decorarMovimientos(egresos, estilosCategoria);

  const egresosFijosItems = egresos.filter((e) => e.esFijo);
  const egresosVariablesItems = egresos.filter((e) => !e.esFijo);
  const totalEgresosVariables = roundMoney(totalEgresos - totalEgresosFijos);
  const tarjetaItems = [...compromisos.cuotas, ...compromisos.cuotaCero].map((c) => ({
    montoPrincipal: c.montoPrincipal,
    categoria: c.categoria || 'Sin categoría',
  }));
  const todosItems = [
    ...egresos.map((e) => ({ montoPrincipal: e.montoPrincipal, categoria: e.categoria })),
    ...tarjetaItems,
  ];

  const categoriasPie = {
    todos: buildCategoryPie(todosItems, estilosCategoria),
    fijos: buildCategoryPie(egresosFijosItems, estilosCategoria),
    tarjeta: buildCategoryPie(tarjetaItems, estilosCategoria),
    variables: buildCategoryPie(egresosVariablesItems, estilosCategoria),
  };

  const destacados = buildDestacados({
    categoriasTodos: categoriasPie.todos,
    pagoTarjetas,
    totalEgresosConTarjetas,
    totalEgresosFijos,
    culminados: compromisos.culminados,
  });

  return {
    ingresos,
    egresos,
    pagoTarjetas,
    pagoTarjetasFormateado: formatMoney(pagoTarjetas),
    resultado,
    totalIngresos,
    totalEgresos,
    totalEgresosFijos,
    totalEgresosFijosFormateado: formatMoney(totalEgresosFijos),
    totalEgresosVariables,
    totalEgresosVariablesFormateado: formatMoney(totalEgresosVariables),
    totalEgresosConTarjetas,
    totalIngresosFormateado: formatMoney(totalIngresos),
    totalEgresosFormateado: formatMoney(totalEgresos),
    totalEgresosConTarjetasFormateado: formatMoney(totalEgresosConTarjetas),
    resultadoFormateado: formatMoney(resultado),
    saldoCuentas,
    saldoCuentasFormateado: formatMoney(saldoCuentas),
    categoriasPie,
    destacados,
    monthKey,
    mensaje: cuentas.length === 0
      ? 'Creá una cuenta para registrar ingresos y egresos.'
      : null,
  };
}

/** Lecturas ya interpretadas del mes, para no obligar a calcular de cabeza. */
function buildDestacados({
  categoriasTodos = [],
  pagoTarjetas = 0,
  totalEgresosConTarjetas = 0,
  totalEgresosFijos = 0,
  culminados = null,
} = {}) {
  const destacados = [];
  const principal = categoriasTodos[0];

  if (principal && principal.pct > 0) {
    destacados.push({
      icono: principal.icon,
      color: principal.color,
      texto: `${principal.alias} concentra el ${principal.pct}% de tus gastos (${principal.totalFormateado}).`,
    });
  }

  if (totalEgresosConTarjetas > 0 && pagoTarjetas > 0) {
    const pct = Math.round((pagoTarjetas / totalEgresosConTarjetas) * 100);
    destacados.push({
      icono: 'fa-credit-card',
      color: '#8b5cf6',
      texto: `Las tarjetas se llevan el ${pct}% de todo lo que gastás este mes.`,
    });
  }

  if (totalEgresosConTarjetas > 0 && totalEgresosFijos > 0) {
    const pct = Math.round((totalEgresosFijos / totalEgresosConTarjetas) * 100);
    destacados.push({
      icono: 'fa-house',
      color: '#0f5c56',
      texto: `Los gastos fijos son el ${pct}% de tus egresos: es la parte que no podés mover.`,
    });
  }

  if (culminados && culminados.count > 0) {
    const plural = culminados.count === 1 ? '' : 's';
    destacados.push({
      icono: 'fa-flag-checkered',
      color: '#16a34a',
      texto: `Termina${plural === '' ? '' : 'n'} ${culminados.count} cuota${plural} este mes: ${culminados.totalFormateado} que dejás de pagar.`,
    });
  }

  return destacados.slice(0, 4);
}

/** Agrega a cada movimiento el estilo de su categoría y su peso relativo, para las tablas. */
function decorarMovimientos(items, estilos) {
  const maxMonto = items.reduce(
    (max, item) => Math.max(max, Number(item.montoPrincipal) || 0),
    0,
  );

  for (const item of items) {
    const estilo = estilos.get(item.categoria) || resolverEstilo({ nombre: item.categoria });
    item.categoriaIcono = estilo.icono;
    item.categoriaColor = estilo.color;
    item.pctDelMayor = maxMonto > 0
      ? Math.round((Number(item.montoPrincipal) / maxMonto) * 1000) / 10
      : 0;
  }

  return items;
}

function buildComparacionGastos(actual, otro, label, { invertido = false } = {}) {
  const gastosActual = actual.totalEgresosConTarjetas;
  const gastosOtro = otro?.totalEgresosConTarjetas ?? 0;

  if (!otro) {
    return {
      label,
      gastos: 0,
      gastosFormateado: formatMoney(0),
      delta: gastosActual,
      deltaFormateado: formatMoney(gastosActual),
      deltaPct: null,
      deltaPctFormateado: '—',
      mejor: false,
      texto: 'Sin datos del mes de comparación.',
    };
  }

  const delta = invertido
    ? roundMoney(gastosOtro - gastosActual)
    : roundMoney(gastosActual - gastosOtro);
  const base = invertido ? gastosActual : gastosOtro;
  const deltaPct = base > 0 ? Math.round((delta / base) * 1000) / 10 : null;
  const deltaAbs = Math.abs(delta);
  const deltaAbsFormateado = formatMoney(deltaAbs);

  let texto;
  let verbo;
  if (delta > 0) {
    verbo = 'mas';
    texto = invertido
      ? `En ${label} vas a gastar ${deltaAbsFormateado} más que este mes`
      : `Este mes gastás ${deltaAbsFormateado} más que en ${label}`;
  } else if (delta < 0) {
    verbo = 'menos';
    texto = invertido
      ? `En ${label} vas a gastar ${deltaAbsFormateado} menos que este mes`
      : `Este mes gastás ${deltaAbsFormateado} menos que en ${label}`;
  } else {
    verbo = 'igual';
    texto = invertido
      ? `En ${label} vas a gastar lo mismo que este mes`
      : `Este mes gastás lo mismo que en ${label}`;
  }

  return {
    label,
    gastos: gastosOtro,
    gastosFormateado: otro.totalEgresosConTarjetasFormateado,
    delta,
    deltaFormateado: formatMoney(delta),
    deltaAbsFormateado,
    deltaPct,
    deltaPctFormateado: deltaPct == null ? '—' : `${deltaPct > 0 ? '+' : ''}${deltaPct}%`,
    mejor: delta <= 0,
    verbo,
    texto,
  };
}

async function saldoAcumuladoAlMes(userId, cuentas, monthKey) {
  const actualKey = currentMonthKey();
  let saldo = 0;

  if (monthKey < actualKey) {
    const mesFin = endOfMonthFromKey(monthKey);
    for (const cuenta of cuentas) {
      const s = await cuentaService.saldoAtDate(cuenta, mesFin);
      const { montoPrincipal } = await divisaService.resolveMontoPrincipal(
        userId,
        cuenta.divisaId,
        s,
      );
      saldo += montoPrincipal;
    }
    return roundMoney(saldo);
  }

  for (const cuenta of cuentas) {
    const { montoPrincipal } = await divisaService.resolveMontoPrincipal(
      userId,
      cuenta.divisaId,
      Number(cuenta.saldoActual),
    );
    saldo += montoPrincipal;
  }

  for (const key of monthKeysInclusive(actualKey, monthKey)) {
    const [ins, outs] = await Promise.all([
      ingresoFijoService.previewPendingForMonth(userId, key),
      gastoFijoService.previewPendingCashForMonth(userId, key),
    ]);
    for (const item of ins) saldo += item.montoPrincipal;
    for (const item of outs) saldo -= item.montoPrincipal;
  }

  return roundMoney(saldo);
}

async function getVistaPlataConContexto(userId, monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const prev = shiftCalendarMonth(y, m, -1);
  const next = shiftCalendarMonth(y, m, 1);
  const prevKey = `${prev.year}-${String(prev.month).padStart(2, '0')}`;
  const nextKey = `${next.year}-${String(next.month).padStart(2, '0')}`;

  const [actual, previo, siguiente] = await Promise.all([
    getVistaPlata(userId, monthKey),
    getVistaPlata(userId, prevKey),
    getVistaPlata(userId, nextKey),
  ]);

  actual.comparacion = {
    previo: buildComparacionGastos(actual, previo, `${MONTH_NAMES[prev.month - 1]} ${prev.year}`),
    siguiente: buildComparacionGastos(
      actual,
      siguiente,
      `${MONTH_NAMES[next.month - 1]} ${next.year}`,
      { invertido: true },
    ),
    serie: [
      {
        key: 'previo',
        label: MONTH_NAMES[prev.month - 1].slice(0, 3),
        labelLargo: `${MONTH_NAMES[prev.month - 1]} ${prev.year}`,
        gastos: previo.totalEgresosConTarjetas,
        formateado: previo.totalEgresosConTarjetasFormateado,
      },
      {
        key: 'actual',
        label: MONTH_NAMES[m - 1].slice(0, 3),
        labelLargo: `${MONTH_NAMES[m - 1]} ${y}`,
        gastos: actual.totalEgresosConTarjetas,
        formateado: actual.totalEgresosConTarjetasFormateado,
        actual: true,
      },
      {
        key: 'siguiente',
        label: MONTH_NAMES[next.month - 1].slice(0, 3),
        labelLargo: `${MONTH_NAMES[next.month - 1]} ${next.year}`,
        gastos: siguiente.totalEgresosConTarjetas,
        formateado: siguiente.totalEgresosConTarjetasFormateado,
      },
    ],
  };

  return actual;
}

module.exports = {
  getVistaPlata,
  getVistaPlataConContexto,
  buildCategoryPie,
};
