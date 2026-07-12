const { z } = require('zod');
const prisma = require('../lib/prisma');
const divisaService = require('./divisa.service');
const cicloService = require('./cicloFacturacion.service');
const cuotaService = require('./cuota.service');
const { parseInputDate } = require('../lib/dates');

const gastoTarjetaSchema = z.object({
  tarjetaId: z.string().min(1),
  montoOriginal: z.coerce.number().positive('Monto debe ser positivo'),
  divisaId: z.string().optional(),
  tasaConversion: z.coerce.number().positive().optional(),
  fechaCompra: z.string().min(1),
  descripcion: z.string().min(1, 'Descripción requerida').max(200),
  categoriaId: z.string().optional().or(z.literal('')),
  cantidadCuotas: z.coerce.number().int().min(1).max(48).default(1),
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

async function createTarjetaGasto(userId, rawData) {
  const parsed = gastoTarjetaSchema.parse(rawData);
  const fechaCompra = parseInputDate(parsed.fechaCompra);
  if (!fechaCompra) throw new Error('Fecha de compra inválida');

  const tarjeta = await cicloService.getTarjetaForUser(parsed.tarjetaId, userId);
  if (tarjeta.titularidad !== 'PROPIA') {
    throw new Error('Solo tarjetas propias en esta versión');
  }

  const divisaId = parsed.divisaId || tarjeta.divisaId;
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

    await cuotaService.generateCuotasForGasto(gasto, tarjeta, tx);
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

module.exports = {
  gastoTarjetaSchema,
  gastoEfectivoSchema,
  listByUser,
  createTarjetaGasto,
  createEfectivoDebitoGasto,
};
