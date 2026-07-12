const prisma = require('../lib/prisma');
const { roundMoney } = require('../lib/money');
const { dateFromMonthKey, endOfMonthFromKey, formatMoney } = require('../lib/dates');
const cuentaService = require('./cuenta.service');
const divisaService = require('./divisa.service');

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
        gasto: { select: { gastoFijoId: true } },
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
      include: { divisa: true, cuenta: true },
      orderBy: [{ fechaCompra: 'asc' }],
    }),
  ]);

  const ingresos = [];
  const egresos = [];
  let totalIngresos = 0;
  let totalEgresos = 0;

  for (const mov of movimientos) {
    const item = {
      id: mov.id,
      descripcion: mov.descripcion || (mov.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'),
      cuenta: mov.cuenta.nombre,
      monto: Number(mov.monto),
      montoPrincipal: Number(mov.montoPrincipal),
      simbolo: mov.divisa.simbolo,
      fecha: mov.fecha,
    };

    if (mov.tipo === 'INGRESO') {
      ingresos.push(item);
      totalIngresos += item.montoPrincipal;
    } else {
      if (mov.gasto?.gastoFijoId) item.esFijo = true;
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
    };
    egresos.push(item);
    totalEgresos += item.montoPrincipal;
  }

  egresos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  let saldoCuentas = 0;
  for (const cuenta of cuentas) {
    const saldo = await cuentaService.saldoAtDate(cuenta, mesFin);
    const { montoPrincipal } = await divisaService.resolveMontoPrincipal(
      userId,
      cuenta.divisaId,
      saldo,
    );
    saldoCuentas += montoPrincipal;
  }
  saldoCuentas = roundMoney(saldoCuentas);

  const resultado = totalIngresos - totalEgresos;

  return {
    ingresos,
    egresos,
    resultado,
    totalIngresos,
    totalEgresos,
    totalIngresosFormateado: formatMoney(totalIngresos),
    totalEgresosFormateado: formatMoney(totalEgresos),
    resultadoFormateado: formatMoney(resultado),
    saldoCuentas,
    saldoCuentasFormateado: formatMoney(saldoCuentas),
    monthKey,
    mensaje: cuentas.length === 0
      ? 'Creá una cuenta para registrar ingresos y egresos.'
      : null,
  };
}

module.exports = {
  getVistaPlata,
};
