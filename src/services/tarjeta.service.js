const { z } = require('zod');
const prisma = require('../lib/prisma');
const { buildDefaultCicloDates, monthKeyFromDate } = require('../lib/dates');
const cicloService = require('./cicloFacturacion.service');

const tarjetaSchema = z.object({
  alias: z.string().min(1, 'Alias requerido').max(80),
  banco: z.string().max(80).optional().or(z.literal('')),
  divisaId: z.string().min(1),
  titularidad: z.enum(['PROPIA', 'TERCERO']).default('PROPIA'),
  defaultCierreDia: z.coerce.number().int().min(1).max(28),
  defaultVencimientoMes: z.coerce.number().int().min(0).max(3).default(1),
});

async function listByUser(userId) {
  return prisma.tarjeta.findMany({
    where: { usuarioId: userId, activa: true },
    include: { divisa: true },
    orderBy: { alias: 'asc' },
  });
}

async function create(userId, data) {
  const parsed = tarjetaSchema.parse(data);

  const divisa = await prisma.divisa.findFirst({
    where: { id: parsed.divisaId, usuarioId: userId },
  });
  if (!divisa) throw new Error('Divisa inválida');

  const tarjeta = await prisma.$transaction(async (tx) => {
    const created = await tx.tarjeta.create({
      data: {
        usuarioId: userId,
        alias: parsed.alias,
        banco: parsed.banco || null,
        divisaId: parsed.divisaId,
        titularidad: parsed.titularidad,
        defaultCierreDia: parsed.defaultCierreDia,
        defaultVencimientoMes: parsed.defaultVencimientoMes,
      },
      include: { divisa: true },
    });

    const now = new Date();
    const monthKey = monthKeyFromDate(now);
    const [year, month] = monthKey.split('-').map(Number);
    const defaults = buildDefaultCicloDates(
      year,
      month,
      created.defaultCierreDia,
      created.defaultVencimientoMes,
    );

    await tx.cicloFacturacion.create({
      data: {
        tarjetaId: created.id,
        mesReferencia: defaults.mesReferencia,
        fechaCierre: defaults.fechaCierre,
        mesVencimiento: defaults.mesVencimiento,
      },
    });

    return created;
  });

  return tarjeta;
}

const tarjetaUpdateSchema = z.object({
  alias: z.string().min(1, 'Alias requerido').max(80),
  banco: z.string().max(80).optional().or(z.literal('')),
  titularidad: z.enum(['PROPIA', 'TERCERO']).default('PROPIA'),
  defaultCierreDia: z.coerce.number().int().min(1).max(28),
  defaultVencimientoMes: z.coerce.number().int().min(0).max(3).default(1),
});

async function update(userId, tarjetaId, data) {
  const parsed = tarjetaUpdateSchema.parse(data);

  const tarjeta = await prisma.tarjeta.findFirst({
    where: { id: tarjetaId, usuarioId: userId, activa: true },
  });
  if (!tarjeta) throw new Error('Tarjeta no encontrada');

  return prisma.tarjeta.update({
    where: { id: tarjetaId },
    data: {
      alias: parsed.alias,
      banco: parsed.banco || null,
      titularidad: parsed.titularidad,
      defaultCierreDia: parsed.defaultCierreDia,
      defaultVencimientoMes: parsed.defaultVencimientoMes,
    },
    include: { divisa: true },
  });
}

async function deactivate(userId, tarjetaId) {
  const tarjeta = await prisma.tarjeta.findFirst({
    where: { id: tarjetaId, usuarioId: userId },
  });
  if (!tarjeta) throw new Error('Tarjeta no encontrada');

  return prisma.tarjeta.update({
    where: { id: tarjetaId },
    data: { activa: false },
  });
}

module.exports = {
  tarjetaSchema,
  listByUser,
  create,
  update,
  deactivate,
};
