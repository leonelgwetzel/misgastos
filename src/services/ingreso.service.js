const { z } = require('zod');
const prisma = require('../lib/prisma');
const { roundMoney } = require('../lib/money');
const { parseInputDate, formatDbDateInput } = require('../lib/dates');
const divisaService = require('./divisa.service');
const cuentaService = require('./cuenta.service');
const movimientoService = require('./movimiento.service');

const ingresoSchema = z.object({
  cuentaId: z.string().min(1, 'Seleccioná una cuenta'),
  monto: z.coerce.number().positive('Monto debe ser positivo'),
  fecha: z.string().min(1),
  descripcion: z.string().max(200).optional().or(z.literal('')),
  categoriaId: z.string().optional().or(z.literal('')),
});

async function getIngresoForUser(userId, ingresoId) {
  const ingreso = await prisma.movimiento.findFirst({
    where: { id: ingresoId, usuarioId: userId, tipo: 'INGRESO' },
    include: { cuenta: true, divisa: true, categoria: true },
  });
  if (!ingreso) throw new Error('Ingreso no encontrado');
  return ingreso;
}

async function searchByUser(userId, { q = '', page = 1, pageSize = 15 } = {}) {
  const where = {
    usuarioId: userId,
    tipo: 'INGRESO',
    ...(q ? { descripcion: { contains: q, mode: 'insensitive' } } : {}),
  };

  const total = await prisma.movimiento.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const items = await prisma.movimiento.findMany({
    where,
    include: {
      divisa: true,
      cuenta: true,
      categoria: true,
    },
    orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
    skip: (safePage - 1) * pageSize,
    take: pageSize,
  });

  return {
    items,
    total,
    page: safePage,
    pageSize,
    totalPages,
    q,
  };
}

async function create(userId, rawData) {
  const parsed = ingresoSchema.parse(rawData);
  return movimientoService.createMovimiento(userId, parsed.cuentaId, {
    tipo: 'INGRESO',
    monto: parsed.monto,
    fecha: parsed.fecha,
    descripcion: parsed.descripcion,
    categoriaId: parsed.categoriaId,
  });
}

async function update(userId, ingresoId, rawData) {
  const parsed = ingresoSchema.parse(rawData);
  const ingreso = await getIngresoForUser(userId, ingresoId);

  if (ingreso.gastoId) {
    throw new Error('No se puede editar un ingreso vinculado a un gasto');
  }
  if (ingreso.ingresoFijoId) {
    throw new Error('Este ingreso viene de un ingreso fijo. Cambiá el monto o omite el mes desde Configuración → Ingresos fijos.');
  }

  const fecha = parseInputDate(parsed.fecha);
  if (!fecha) throw new Error('Fecha inválida');

  const nuevaCuenta = await cuentaService.getForUser(parsed.cuentaId, userId);
  const monto = roundMoney(parsed.monto);
  const { tasaConversion, montoPrincipal } = await divisaService.resolveMontoPrincipal(
    userId,
    nuevaCuenta.divisaId,
    monto,
  );

  return prisma.$transaction(async (tx) => {
    const cuentaAnterior = await tx.cuenta.findUnique({ where: { id: ingreso.cuentaId } });
    await tx.cuenta.update({
      where: { id: ingreso.cuentaId },
      data: {
        saldoActual: roundMoney(Number(cuentaAnterior.saldoActual) - Number(ingreso.monto)),
      },
    });

    const updated = await tx.movimiento.update({
      where: { id: ingreso.id },
      data: {
        cuentaId: nuevaCuenta.id,
        monto,
        divisaId: nuevaCuenta.divisaId,
        tasaConversion,
        montoPrincipal,
        fecha,
        descripcion: parsed.descripcion || null,
        categoriaId: parsed.categoriaId || null,
      },
      include: { divisa: true, cuenta: true, categoria: true },
    });

    const cuentaDestino = await tx.cuenta.findUnique({ where: { id: nuevaCuenta.id } });
    await tx.cuenta.update({
      where: { id: nuevaCuenta.id },
      data: {
        saldoActual: roundMoney(Number(cuentaDestino.saldoActual) + monto),
      },
    });

    return updated;
  });
}

async function remove(userId, ingresoId) {
  const ingreso = await getIngresoForUser(userId, ingresoId);

  if (ingreso.gastoId) {
    throw new Error('No se puede borrar un ingreso vinculado a un gasto');
  }
  if (ingreso.ingresoFijoId) {
    throw new Error('Este ingreso viene de un ingreso fijo. Desactivalo u omite el mes desde Configuración → Ingresos fijos.');
  }

  return prisma.$transaction(async (tx) => {
    await tx.cuenta.update({
      where: { id: ingreso.cuentaId },
      data: {
        saldoActual: roundMoney(Number(ingreso.cuenta.saldoActual) - Number(ingreso.monto)),
      },
    });

    return tx.movimiento.delete({ where: { id: ingreso.id } });
  });
}

function toFormValues(ingreso) {
  return {
    cuentaId: ingreso.cuentaId,
    monto: Number(ingreso.monto),
    fecha: formatDbDateInput(ingreso.fecha),
    descripcion: ingreso.descripcion || '',
    categoriaId: ingreso.categoriaId || '',
  };
}

module.exports = {
  ingresoSchema,
  searchByUser,
  create,
  update,
  remove,
  getIngresoForUser,
  toFormValues,
};
