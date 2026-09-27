const { z } = require('zod');
const prisma = require('../lib/prisma');
const { roundMoney } = require('../lib/money');
const divisaService = require('./divisa.service');
const cicloService = require('./cicloFacturacion.service');
const cuotaService = require('./cuota.service');
const { parseInputDate } = require('../lib/dates');

const mesImpactoPrimeraSchema = z
  .string()
  .optional()
  .or(z.literal(''))
  .transform((v) => (v && String(v).trim() ? String(v).trim() : null))
  .refine((v) => v == null || /^\d{4}-\d{2}$/.test(v), {
    message: 'Mes de impacto inválido (usá YYYY-MM)',
  })
  .refine((v) => {
    if (v == null) return true;
    const month = Number(v.slice(5, 7));
    return month >= 1 && month <= 12;
  }, {
    message: 'Mes de impacto inválido',
  });

const gastoTarjetaSchema = z.object({
  tarjetaId: z.string().min(1),
  montoOriginal: z.coerce.number().positive('Monto debe ser positivo'),
  fechaCompra: z.string().min(1),
  descripcion: z.string().min(1, 'Descripción requerida').max(200),
  categoriaId: z.string().optional().or(z.literal('')),
  cantidadCuotas: z.coerce.number().int().min(1).max(48).default(1),
  mesImpactoPrimera: mesImpactoPrimeraSchema,
});

const gastoEfectivoSchema = z.object({
  medioPago: z.enum(['EFECTIVO', 'DEBITO']),
  montoOriginal: z.coerce.number().positive('Monto debe ser positivo'),
  divisaId: z.string().min(1),
  tasaConversion: z.coerce.number().positive().optional(),
  fechaCompra: z.string().min(1),
  descripcion: z.string().min(1, 'Descripción requerida').max(200),
  categoriaId: z.string().optional().or(z.literal('')),
  cuentaId: z.string().optional().or(z.literal('')),
});

async function listByUser(userId, { limit = 50 } = {}) {
  return prisma.gasto.findMany({
    where: { usuarioId: userId },
    include: {
      divisa: true,
      tarjeta: true,
      cuenta: true,
      categoria: true,
      cuotas: { orderBy: { numero: 'asc' } },
    },
    orderBy: { fechaCompra: 'desc' },
    take: limit,
  });
}

async function searchByUser(userId, { q = '', page = 1, pageSize = 15 } = {}) {
  const where = {
    usuarioId: userId,
    ...(q ? { descripcion: { contains: q, mode: 'insensitive' } } : {}),
  };

  const total = await prisma.gasto.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const items = await prisma.gasto.findMany({
    where,
    include: {
      divisa: true,
      tarjeta: true,
      cuenta: true,
      categoria: true,
    },
    orderBy: [{ fechaCompra: 'desc' }, { createdAt: 'desc' }],
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

async function createTarjetaGasto(userId, rawData) {
  const parsed = gastoTarjetaSchema.parse(rawData);
  const fechaCompra = parseInputDate(parsed.fechaCompra);
  if (!fechaCompra) throw new Error('Fecha de compra inválida');

  const tarjeta = await cicloService.getTarjetaForUser(parsed.tarjetaId, userId);
  if (tarjeta.titularidad !== 'PROPIA') {
    throw new Error('Solo tarjetas propias en esta versión');
  }

  const divisaId = tarjeta.divisaId;
  const { tasaConversion, montoPrincipal } = await divisaService.resolveMontoPrincipal(
    userId,
    divisaId,
    parsed.montoOriginal,
    parsed.tasaConversion,
  );

  return prisma.$transaction(async (tx) => {
    const gasto = await tx.gasto.create({
      data: {
        usuarioId: userId,
        tarjetaId: tarjeta.id,
        montoOriginal: parsed.montoOriginal,
        divisaId,
        tasaConversion,
        montoPrincipal,
        fechaCompra,
        descripcion: parsed.descripcion,
        categoriaId: parsed.categoriaId || null,
        medioPago: 'TARJETA',
        cantidadCuotas: parsed.cantidadCuotas,
      },
      include: { divisa: true, tarjeta: true },
    });

    await cuotaService.generateCuotasForGasto(gasto, tarjeta, tx, {
      mesImpactoPrimera: parsed.mesImpactoPrimera,
    });
    return gasto;
  });
}

async function createEfectivoDebitoGasto(userId, rawData, meta = {}) {
  const parsed = gastoEfectivoSchema.parse(rawData);
  const fechaCompra = parseInputDate(parsed.fechaCompra);
  if (!fechaCompra) throw new Error('Fecha de compra inválida');

  const divisa = await prisma.divisa.findFirst({
    where: { id: parsed.divisaId, usuarioId: userId },
  });
  if (!divisa) throw new Error('Divisa inválida');

  let cuenta = null;
  if (parsed.cuentaId) {
    cuenta = await prisma.cuenta.findFirst({
      where: { id: parsed.cuentaId, usuarioId: userId, activa: true },
    });
    if (!cuenta) throw new Error('Cuenta no encontrada');
  }

  const { tasaConversion, montoPrincipal } = await divisaService.resolveMontoPrincipal(
    userId,
    parsed.divisaId,
    parsed.montoOriginal,
    parsed.tasaConversion,
  );

  const movimientoService = require('./movimiento.service');

  return prisma.$transaction(async (tx) => {
    const gasto = await tx.gasto.create({
      data: {
        usuarioId: userId,
        cuentaId: cuenta?.id || null,
        montoOriginal: parsed.montoOriginal,
        divisaId: parsed.divisaId,
        tasaConversion,
        montoPrincipal,
        fechaCompra,
        descripcion: parsed.descripcion,
        categoriaId: parsed.categoriaId || null,
        medioPago: parsed.medioPago,
        cantidadCuotas: 1,
        gastoFijoId: meta.gastoFijoId || null,
        mesGenerado: meta.mesGenerado || null,
      },
      include: { divisa: true, cuenta: true },
    });

    if (cuenta) {
      await movimientoService.createEgresoFromGasto(userId, cuenta.id, gasto, tx);
    }

    return gasto;
  });
}

const gastoMetaSchema = z.object({
  descripcion: z.string().min(1, 'Descripción requerida').max(200),
  categoriaId: z.string().optional().or(z.literal('')),
});

async function updateGastoMeta(userId, gastoId, rawData) {
  const parsed = gastoMetaSchema.parse(rawData);
  const gasto = await prisma.gasto.findFirst({
    where: { id: gastoId, usuarioId: userId },
  });
  if (!gasto) throw new Error('Gasto no encontrado');

  return prisma.gasto.update({
    where: { id: gasto.id },
    data: {
      descripcion: parsed.descripcion,
      categoriaId: parsed.categoriaId || null,
    },
    include: { divisa: true, tarjeta: true, cuenta: true, categoria: true },
  });
}

async function deleteTarjetaGasto(userId, gastoId) {
  const gasto = await prisma.gasto.findFirst({
    where: { id: gastoId, usuarioId: userId, medioPago: 'TARJETA' },
    include: { cuotas: true },
  });
  if (!gasto) throw new Error('Gasto no encontrado');

  if (gasto.cuotas.some((c) => c.estado === 'PAGADA')) {
    throw new Error('No se puede borrar un gasto con cuotas pagadas');
  }

  return prisma.gasto.delete({ where: { id: gasto.id } });
}

async function deleteEfectivoDebitoGasto(userId, gastoId) {
  const gasto = await prisma.gasto.findFirst({
    where: {
      id: gastoId,
      usuarioId: userId,
      medioPago: { in: ['EFECTIVO', 'DEBITO'] },
    },
    include: { movimientos: true },
  });
  if (!gasto) throw new Error('Gasto no encontrado');

  return prisma.$transaction(async (tx) => {
    for (const mov of gasto.movimientos) {
      const cuenta = await tx.cuenta.findUnique({ where: { id: mov.cuentaId } });
      if (cuenta) {
        const delta = mov.tipo === 'EGRESO' ? Number(mov.monto) : -Number(mov.monto);
        await tx.cuenta.update({
          where: { id: cuenta.id },
          data: { saldoActual: roundMoney(Number(cuenta.saldoActual) + delta) },
        });
      }
      await tx.movimiento.delete({ where: { id: mov.id } });
    }
    return tx.gasto.delete({ where: { id: gasto.id } });
  });
}

async function deleteGasto(userId, gastoId) {
  const gasto = await prisma.gasto.findFirst({
    where: { id: gastoId, usuarioId: userId },
  });
  if (!gasto) throw new Error('Gasto no encontrado');
  if (gasto.medioPago === 'TARJETA') {
    return deleteTarjetaGasto(userId, gastoId);
  }
  return deleteEfectivoDebitoGasto(userId, gastoId);
}

/** Corrige gastos con tarjeta guardados con divisa principal por error de formulario. */
async function repairTarjetaGastoDivisas(userId) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: userId },
    include: { divisaPrincipal: true },
  });
  if (!usuario?.divisaPrincipalId) return 0;

  const gastos = await prisma.gasto.findMany({
    where: { usuarioId: userId, medioPago: 'TARJETA', tarjetaId: { not: null } },
    include: { tarjeta: { include: { divisa: true } }, cuotas: true },
  });

  let fixed = 0;

  for (const gasto of gastos) {
    if (!gasto.tarjeta) continue;
    // Solo cuando el formulario coló la divisa principal pero la tarjeta es en otra divisa.
    if (gasto.divisaId !== usuario.divisaPrincipalId) continue;
    if (gasto.tarjeta.divisaId === usuario.divisaPrincipalId) continue;

    const divisaId = gasto.tarjeta.divisaId;
    const { tasaConversion, montoPrincipal } = await divisaService.resolveMontoPrincipal(
      userId,
      divisaId,
      gasto.montoOriginal,
    );

    await prisma.$transaction(async (tx) => {
      await tx.gasto.update({
        where: { id: gasto.id },
        data: { divisaId, tasaConversion, montoPrincipal },
      });

      for (const cuota of gasto.cuotas) {
        const conv = await divisaService.resolveMontoPrincipal(
          userId,
          divisaId,
          cuota.montoOriginal,
        );
        await tx.cuota.update({
          where: { id: cuota.id },
          data: {
            divisaId,
            tasaConversion: conv.tasaConversion,
            montoPrincipal: conv.montoPrincipal,
          },
        });
      }
    });

    fixed += 1;
    console.log(`Reparado: ${gasto.descripcion} → divisa ${gasto.tarjeta.divisa.codigo}`);
  }

  return fixed;
}

module.exports = {
  gastoTarjetaSchema,
  gastoEfectivoSchema,
  listByUser,
  searchByUser,
  createTarjetaGasto,
  createEfectivoDebitoGasto,
  updateGastoMeta,
  deleteTarjetaGasto,
  deleteGasto,
  repairTarjetaGastoDivisas,
};
