const prisma = require('../lib/prisma');
const {
  buildDefaultCicloDates,
  dateFromMonthKey,
  fromDbDate,
  monthKeyFromDate,
  parseInputDate,
  shiftCalendarMonth,
  utcDate,
} = require('../lib/dates');

async function getTarjetaForUser(tarjetaId, userId) {
  const tarjeta = await prisma.tarjeta.findFirst({
    where: { id: tarjetaId, usuarioId: userId, activa: true },
    include: { divisa: true },
  });
  if (!tarjeta) throw new Error('Tarjeta no encontrada');
  return tarjeta;
}

async function getCicloForMonth(tarjetaId, monthKey) {
  const mesReferencia = dateFromMonthKey(monthKey);
  return prisma.cicloFacturacion.findUnique({
    where: {
      tarjetaId_mesReferencia: { tarjetaId, mesReferencia },
    },
  });
}

async function getOrCreateCiclo(tarjeta, monthKey) {
  const existing = await getCicloForMonth(tarjeta.id, monthKey);
  if (existing) return existing;

  const [year, month] = monthKey.split('-').map(Number);
  const defaults = buildDefaultCicloDates(
    year,
    month,
    tarjeta.defaultCierreDia,
    tarjeta.defaultVencimientoMes,
  );

  return prisma.cicloFacturacion.create({
    data: {
      tarjetaId: tarjeta.id,
      mesReferencia: defaults.mesReferencia,
      fechaCierre: defaults.fechaCierre,
      mesVencimiento: defaults.mesVencimiento,
    },
  });
}

async function upsertCiclo(userId, tarjetaId, monthKey, { fechaCierre, mesVencimiento }) {
  const tarjeta = await getTarjetaForUser(tarjetaId, userId);
  const mesReferencia = dateFromMonthKey(monthKey);
  const cierre = parseInputDate(fechaCierre);
  const vencimiento = parseInputDate(mesVencimiento);

  if (!cierre || !vencimiento) {
    throw new Error('Fechas de ciclo inválidas');
  }

  return prisma.cicloFacturacion.upsert({
    where: {
      tarjetaId_mesReferencia: { tarjetaId: tarjeta.id, mesReferencia },
    },
    create: {
      tarjetaId: tarjeta.id,
      mesReferencia,
      fechaCierre: cierre,
      mesVencimiento: startOfMonthOnly(vencimiento),
    },
    update: {
      fechaCierre: cierre,
      mesVencimiento: startOfMonthOnly(vencimiento),
    },
  });
}

function startOfMonthOnly(date) {
  const d = fromDbDate(date);
  return utcDate(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}

/**
 * Determina el ciclo al que pertenece una compra (RB-003).
 */
async function findCicloForPurchase(tarjeta, fechaCompra) {
  const purchaseMonthKey = monthKeyFromDate(fechaCompra);
  let ciclo = await getOrCreateCiclo(tarjeta, purchaseMonthKey);

  const compra = fromDbDate(fechaCompra);
  const cierre = fromDbDate(ciclo.fechaCierre);

  if (compra > cierre) {
    const [y, m] = purchaseMonthKey.split('-').map(Number);
    const next = shiftCalendarMonth(y, m, 1);
    const nextKey = `${next.year}-${String(next.month).padStart(2, '0')}`;
    ciclo = await getOrCreateCiclo(tarjeta, nextKey);
  }

  return ciclo;
}

async function getMesVencimientoForInstallment(cicloInicial, installmentIndex) {
  const base = fromDbDate(cicloInicial.mesVencimiento);
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth() + 1;
  const shifted = shiftCalendarMonth(y, m, installmentIndex);
  return utcDate(shifted.year, shifted.month, 1);
}

module.exports = {
  getTarjetaForUser,
  getCicloForMonth,
  getOrCreateCiclo,
  upsertCiclo,
  findCicloForPurchase,
  getMesVencimientoForInstallment,
};
