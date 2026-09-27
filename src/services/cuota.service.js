const prisma = require('../lib/prisma');
const { splitInstallments } = require('../lib/money');
const {
  monthKeyFromDate,
  dateFromMonthKey,
  isCycleOpen,
  shiftCalendarMonth,
} = require('../lib/dates');
const cicloService = require('./cicloFacturacion.service');
const divisaService = require('./divisa.service');

function mesImpactoFromPrimera(mesImpactoPrimera, installmentIndex) {
  const [year, month] = mesImpactoPrimera.split('-').map(Number);
  const shifted = shiftCalendarMonth(year, month, installmentIndex);
  return dateFromMonthKey(`${shifted.year}-${String(shifted.month).padStart(2, '0')}`);
}

async function generateCuotasForGasto(gasto, tarjeta, tx = prisma, options = {}) {
  const db = tx;
  const amounts = splitInstallments(gasto.montoOriginal, gasto.cantidadCuotas);
  const fechaCompra = new Date(gasto.fechaCompra);
  const ciclo = await cicloService.findCicloForPurchase(tarjeta, fechaCompra);
  const cuotas = [];
  const mesImpactoPrimera = options.mesImpactoPrimera || null;

  const showCuotaCero = isCycleOpen(ciclo.fechaCierre);
  const purchaseMonth = dateFromMonthKey(monthKeyFromDate(fechaCompra));

  if (showCuotaCero) {
    const { tasaConversion, montoPrincipal } = await divisaService.resolveMontoPrincipal(
      gasto.usuarioId,
      gasto.divisaId,
      amounts[0],
    );

    cuotas.push({
      gastoId: gasto.id,
      numero: 0,
      montoOriginal: amounts[0],
      divisaId: gasto.divisaId,
      tasaConversion,
      montoPrincipal,
      mesImpacto: purchaseMonth,
      estado: 'PENDIENTE_FACTURAR',
    });
  }

  for (let i = 0; i < gasto.cantidadCuotas; i += 1) {
    const mesImpacto = mesImpactoPrimera
      ? mesImpactoFromPrimera(mesImpactoPrimera, i)
      : await cicloService.getMesVencimientoForInstallment(ciclo, i);
    const { tasaConversion, montoPrincipal } = await divisaService.resolveMontoPrincipal(
      gasto.usuarioId,
      gasto.divisaId,
      amounts[i],
    );

    cuotas.push({
      gastoId: gasto.id,
      numero: i + 1,
      montoOriginal: amounts[i],
      divisaId: gasto.divisaId,
      tasaConversion,
      montoPrincipal,
      mesImpacto,
      estado: 'COMPROMETIDA',
    });
  }

  if (cuotas.length > 0) {
    await db.cuota.createMany({ data: cuotas });
  }

  return cuotas;
}

/** Recalcula mesImpacto de cuotas existentes (corrige datos generados con bug de zona horaria). */
async function recalculateMesImpactoForTarjetaGastos(userId) {
  const gastos = await prisma.gasto.findMany({
    where: { usuarioId: userId, medioPago: 'TARJETA', tarjetaId: { not: null } },
    include: { tarjeta: true, cuotas: { orderBy: { numero: 'asc' } } },
  });

  for (const gasto of gastos) {
    const ciclo = await cicloService.findCicloForPurchase(gasto.tarjeta, gasto.fechaCompra);
    const purchaseMonth = dateFromMonthKey(monthKeyFromDate(gasto.fechaCompra));
    const showCuotaCero = isCycleOpen(ciclo.fechaCierre);

    for (const cuota of gasto.cuotas) {
      if (cuota.numero === 0) {
        if (!showCuotaCero) {
          await prisma.cuota.delete({ where: { id: cuota.id } });
        } else {
          await prisma.cuota.update({
            where: { id: cuota.id },
            data: { mesImpacto: purchaseMonth },
          });
        }
        continue;
      }

      const mesImpacto = await cicloService.getMesVencimientoForInstallment(
        ciclo,
        cuota.numero - 1,
      );
      await prisma.cuota.update({
        where: { id: cuota.id },
        data: { mesImpacto },
      });
    }
  }
}

function shouldShowCuotaCero(cuota, cicloFechaCierre, viewDate = new Date()) {
  if (cuota.numero !== 0 || cuota.estado !== 'PENDIENTE_FACTURAR') return false;
  return isCycleOpen(cicloFechaCierre, viewDate);
}

module.exports = {
  generateCuotasForGasto,
  shouldShowCuotaCero,
  recalculateMesImpactoForTarjetaGastos,
};
